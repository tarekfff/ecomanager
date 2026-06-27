import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db, rpc } from '@/lib/db'
import { google } from 'googleapis'
import { v4 as uuid } from 'uuid'

const MAX_ROWS = 1000

interface Mapping {
  order_ref:       string
  client_name:     string
  phone:           string
  email:           string
  phone2:          string
  wilaya:          string
  commune:         string
  address:         string
  remark:          string
  delivery_method: string
  product_sku:     string
  quantity:        string
  unit_price:      string
  ip_address:      string
  referrer:        string
}

interface ImportBody {
  sheet_id:     string
  sheet_name:   string
  separator:    string
  boutique_id:  string
  google_token: string
  mapping:      Mapping
}

function cell(row: string[], headers: string[], col: string): string {
  if (!col) return ''
  const idx = headers.indexOf(col)
  return idx >= 0 ? String(row[idx] ?? '').trim() : ''
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req)
  const body = await req.json() as ImportBody
  const { sheet_id, sheet_name, separator, boutique_id, google_token, mapping } = body

  if (!sheet_id || !boutique_id || !google_token) {
    return NextResponse.json({ error: 'sheet_id, boutique_id et google_token requis' }, { status: 400 })
  }

  // Verify boutique belongs to this tenant
  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', boutique_id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable' }, { status: 403 })

  // ── Read Google Sheet ───────────────────────────────────────────────────────

  let rawRows: string[][] = []
  let headers: string[]   = []

  try {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: google_token })

    const sheets  = google.sheets({ version: 'v4', auth })
    const tabName = sheet_name || 'Sheet1'

    // Use spreadsheets.get with includeGridData to avoid range-string parsing issues
    const { data } = await sheets.spreadsheets.get({
      spreadsheetId:   sheet_id,
      includeGridData: true,
    })

    const targetSheet = tabName
      ? data.sheets?.find(s => s.properties?.title === tabName) ?? data.sheets?.[0]
      : data.sheets?.[0]

    const allRowData = targetSheet?.data?.[0]?.rowData ?? []

    rawRows = allRowData
      .slice(0, MAX_ROWS + 1)
      .map(row =>
        (row.values ?? []).map(cell =>
          String(cell.formattedValue ?? cell.userEnteredValue?.stringValue ?? '').trim()
        )
      )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erreur lecture Google Sheets: ${msg}` }, { status: 500 })
  }

  if (rawRows.length < 2) {
    return NextResponse.json({ imported: 0, skipped: 0, failed: 0, errors: [] })
  }

  headers     = rawRows[0].map((h: string) => String(h ?? '').trim())
  const dataRows = rawRows.slice(1).filter(row => row.some(c => String(c ?? '').trim()))

  // ── Pre-load lookup caches ─────────────────────────────────────────────────

  const { data: wilayaData } = await db.from('wilayas').select('id, name')
  const wilayaMap = new Map<string, number>()
  for (const w of (wilayaData ?? []) as { id: number; name: string }[]) {
    wilayaMap.set(w.name.toLowerCase().trim(), w.id)
  }

  const { data: communeData } = await db.from('communes').select('id, name, wilaya_id')
  const communeMap = new Map<string, number>() // key: `${wilaya_id}:${name_lower}`
  for (const c of (communeData ?? []) as { id: number; name: string; wilaya_id: number }[]) {
    communeMap.set(`${c.wilaya_id}:${c.name.toLowerCase().trim()}`, c.id)
  }

  // SKU → product cache
  const skuCache   = new Map<string, { product_id: string; product_name: string; unit_cost: number } | null>()
  // phone → client_id cache
  const clientCache = new Map<string, string>()
  // reference → exists cache (for skip-duplicate check)
  const { data: existingRefs } = await db
    .from('orders')
    .select('reference')
    .eq('boutique_id', boutique_id)
    .is('deleted_at', null)
  const existingRefSet = new Set<string>(
    (existingRefs ?? []).map((r: { reference: string }) => r.reference)
  )

  // ── Process rows ───────────────────────────────────────────────────────────

  const sep       = separator || '|'
  let imported    = 0
  let skipped     = 0
  const errors: { row: number; reason: string }[] = []

  for (let ri = 0; ri < dataRows.length; ri++) {
    const rowNum = ri + 2 // offset +2 (1=header, 2=first data row)
    const row    = dataRows[ri]

    const orderRef     = cell(row, headers, mapping.order_ref)
    const clientName   = cell(row, headers, mapping.client_name)
    const phone        = cell(row, headers, mapping.phone)
    const email        = cell(row, headers, mapping.email)
    const phone2       = cell(row, headers, mapping.phone2)
    const wilayaRaw    = cell(row, headers, mapping.wilaya)
    const communeRaw   = cell(row, headers, mapping.commune)
    const address      = cell(row, headers, mapping.address)
    const remark       = cell(row, headers, mapping.remark)
    const delivMethod  = cell(row, headers, mapping.delivery_method)
    const productSkus  = cell(row, headers, mapping.product_sku)
    const quantityRaw  = cell(row, headers, mapping.quantity)
    const unitPriceRaw = cell(row, headers, mapping.unit_price)
    const referrer     = cell(row, headers, mapping.referrer)

    // Required field validation
    if (!clientName) { errors.push({ row: rowNum, reason: 'Nom client manquant' }); continue }
    if (!phone)      { errors.push({ row: rowNum, reason: 'Téléphone manquant' }); continue }
    if (!wilayaRaw)  { errors.push({ row: rowNum, reason: 'Wilaya manquante' }); continue }
    if (!productSkus){ errors.push({ row: rowNum, reason: 'SKU produit manquant' }); continue }

    // Skip duplicate by order reference
    if (orderRef && existingRefSet.has(orderRef)) {
      skipped++
      continue
    }

    // ── Wilaya / commune lookup ──────────────────────────────────────────────

    const wilayaId = wilayaMap.get(wilayaRaw.toLowerCase().trim()) ?? null
    if (!wilayaId) {
      errors.push({ row: rowNum, reason: `Wilaya introuvable: "${wilayaRaw}"` })
      continue
    }

    let communeId: number | null = null
    if (communeRaw) {
      communeId = communeMap.get(`${wilayaId}:${communeRaw.toLowerCase().trim()}`) ?? null
      if (!communeId) {
        errors.push({ row: rowNum, reason: `Commune introuvable: "${communeRaw}" (wilaya ${wilayaRaw})` })
        continue
      }
    }

    // ── Products / SKUs ──────────────────────────────────────────────────────

    const skuList  = productSkus.split(sep).map(s => s.trim()).filter(Boolean)
    const qtyList  = quantityRaw.split(sep).map(s => parseInt(s.trim()) || 1)
    const priceList = unitPriceRaw.split(sep).map(s => parseFloat(s.trim()) || 0)

    interface OrderItemInsert {
      id: string; order_id: string; product_id: string; variant_id: null;
      product_name: string; sku: string; quantity: number; unit_price: number; unit_cost: number;
    }
    const orderItems: Omit<OrderItemInsert, 'order_id'>[] = []

    let rowFailed = false
    for (let si = 0; si < skuList.length; si++) {
      const sku = skuList[si]
      if (!skuCache.has(sku)) {
        const { data: prod } = await db
          .from('products')
          .select('id, name, price')
          .eq('tenant_id', user.tenantId)
          .or(`sku.eq.${sku},barcode.eq.${sku}`)
          .is('deleted_at', null)
          .maybeSingle()
        skuCache.set(sku, prod ? { product_id: prod.id, product_name: prod.name, unit_cost: 0 } : null)
      }

      const prod = skuCache.get(sku)
      if (!prod) {
        errors.push({ row: rowNum, reason: `SKU introuvable: "${sku}"` })
        rowFailed = true
        break
      }

      orderItems.push({
        id:           uuid(),
        product_id:   prod.product_id,
        variant_id:   null,
        product_name: prod.product_name,
        sku,
        quantity:     qtyList[si] ?? 1,
        unit_price:   priceList[si] || 0,
        unit_cost:    prod.unit_cost,
      })
    }
    if (rowFailed) continue

    // ── Upsert client ────────────────────────────────────────────────────────

    let clientId: string
    if (clientCache.has(phone)) {
      clientId = clientCache.get(phone)!
    } else {
      const { data: existing } = await db
        .from('clients')
        .select('id')
        .eq('tenant_id', user.tenantId)
        .eq('phone', phone)
        .maybeSingle()

      if (existing) {
        clientId = (existing as { id: string }).id
      } else {
        clientId = uuid()
        const { error: cErr } = await db.from('clients').insert({
          id:        clientId,
          tenant_id: user.tenantId,
          full_name: clientName,
          phone,
          phone2:    phone2 || null,
          email:     email  || null,
          wilaya_id:  wilayaId,
          commune_id: communeId,
          address:   address || null,
        })
        if (cErr) {
          errors.push({ row: rowNum, reason: `Erreur client: ${cErr.message}` })
          continue
        }
      }
      clientCache.set(phone, clientId)
    }

    // ── Generate reference & insert order ────────────────────────────────────

    try {
      const reference = await rpc<string>('generate_order_reference', { p_boutique_id: boutique_id })

      const deliveryMethod = (delivMethod.toLowerCase().includes('stop') ? 'stopdesk' : 'domicile') as 'domicile' | 'stopdesk'
      const subtotal       = orderItems.reduce((s, it) => s + it.unit_price * it.quantity, 0)
      const orderId        = uuid()

      const { error: oErr } = await db.from('orders').insert({
        id:              orderId,
        boutique_id:     boutique_id,
        client_id:       clientId,
        reference,
        tracking_status: 'en_confirmation',
        subtotal,
        delivery_fee:    0,
        discount:        0,
        delivery_method: deliveryMethod,
        wilaya_id:       wilayaId,
        commune_id:      communeId ?? null,
        address:         address   || null,
        phone,
        phone2:          phone2    || null,
        referrer:        referrer  || null,
        remark:          remark    || null,
        source_type:     'google_sheet',
        sync_enabled:    true,
      })

      if (oErr) {
        errors.push({ row: rowNum, reason: `Erreur commande: ${oErr.message}` })
        continue
      }

      await db.from('order_items').insert(
        orderItems.map(it => ({ ...it, order_id: orderId }))
      )

      existingRefSet.add(reference)
      imported++
    } catch (err: unknown) {
      errors.push({ row: rowNum, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    failed: errors.length,
    errors,
  })
}
