import { google } from 'googleapis'
import { db, rpc } from '@/lib/db'
import { v4 as uuid } from 'uuid'

const MAX_ROWS = 1000

export interface SheetMapping {
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

export interface SyncResult {
  imported:  number
  skipped:   number
  failed:    number
  errors:    { row: number; reason: string }[]
  last_row:  number   // updated total row count (including header)
}

interface SyncParams {
  accessToken:  string
  sheetId:      string
  sheetName:    string
  separator:    string
  boutiqueId:   string
  mapping:      SheetMapping
  startRow:     number    // 1 = start fresh (row 2 = first data); N = resume from row N+1
  tenantId:     string
  userId:       string
}

function cell(row: string[], headers: string[], col: string): string {
  if (!col) return ''
  const idx = headers.indexOf(col)
  return idx >= 0 ? String(row[idx] ?? '').trim() : ''
}

export async function syncGoogleSheet(params: SyncParams): Promise<SyncResult> {
  const {
    accessToken, sheetId, sheetName, separator, boutiqueId,
    mapping, startRow, tenantId, userId,
  } = params

  // ── Read sheet rows ──────────────────────────────────────────────────────────

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const sheets = google.sheets({ version: 'v4', auth })
  const tab    = sheetName || 'Sheet1'

  // Always fetch header row separately so we know column positions
  const [headerRes, dataRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tab}!A1:ZZ1` }),
    sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tab}!A${startRow + 1}:ZZ${startRow + MAX_ROWS}`,
    }),
  ])

  const headerRow = ((headerRes.data.values ?? [])[0] ?? []) as string[]
  const headers   = headerRow.map((h: string) => String(h ?? '').trim())
  if (headers.length === 0) {
    return { imported: 0, skipped: 0, failed: 0, errors: [], last_row: startRow }
  }

  const rawDataRows = (dataRes.data.values ?? []) as string[][]
  const dataRows    = rawDataRows.filter(r => r.some(c => String(c ?? '').trim()))
  const newLastRow  = startRow + dataRows.length

  if (dataRows.length === 0) {
    return { imported: 0, skipped: 0, failed: 0, errors: [], last_row: newLastRow }
  }

  // ── Pre-load lookup caches ──────────────────────────────────────────────────

  const { data: wilayaData } = await db.from('wilayas').select('id, name')
  const wilayaMap = new Map<string, number>()
  for (const w of (wilayaData ?? []) as { id: number; name: string }[]) {
    wilayaMap.set(w.name.toLowerCase().trim(), w.id)
  }

  const { data: communeData } = await db.from('communes').select('id, name, wilaya_id')
  const communeMap = new Map<string, number>()
  for (const c of (communeData ?? []) as { id: number; name: string; wilaya_id: number }[]) {
    communeMap.set(`${c.wilaya_id}:${c.name.toLowerCase().trim()}`, c.id)
  }

  const skuCache    = new Map<string, { product_id: string; product_name: string } | null>()
  const clientCache = new Map<string, string>()

  // ── Process rows ────────────────────────────────────────────────────────────

  const sep    = separator || '|'
  let imported = 0
  let skipped  = 0
  const errors: { row: number; reason: string }[] = []

  for (let ri = 0; ri < dataRows.length; ri++) {
    const rowNum = startRow + ri + 1  // absolute sheet row number
    const row    = dataRows[ri]

    const clientName   = cell(row, headers, mapping.client_name)
    const phone        = cell(row, headers, mapping.phone)
    const wilayaRaw    = cell(row, headers, mapping.wilaya)
    const communeRaw   = cell(row, headers, mapping.commune)
    const address      = cell(row, headers, mapping.address)
    const email        = cell(row, headers, mapping.email)
    const phone2       = cell(row, headers, mapping.phone2)
    const remark       = cell(row, headers, mapping.remark)
    const delivMethod  = cell(row, headers, mapping.delivery_method)
    const productSkus  = cell(row, headers, mapping.product_sku)
    const quantityRaw  = cell(row, headers, mapping.quantity)
    const unitPriceRaw = cell(row, headers, mapping.unit_price)
    const referrer     = cell(row, headers, mapping.referrer)

    if (!clientName) { errors.push({ row: rowNum, reason: 'Nom client manquant' }); continue }
    if (!phone)      { errors.push({ row: rowNum, reason: 'Téléphone manquant' }); continue }
    if (!wilayaRaw)  { errors.push({ row: rowNum, reason: 'Wilaya manquante' }); continue }
    if (!productSkus){ errors.push({ row: rowNum, reason: 'SKU produit manquant' }); continue }

    // ── Wilaya / commune lookup ────────────────────────────────────────────────

    const wilayaId = wilayaMap.get(wilayaRaw.toLowerCase().trim()) ?? null
    if (!wilayaId) {
      errors.push({ row: rowNum, reason: `Wilaya introuvable: "${wilayaRaw}"` })
      continue
    }

    let communeId: number | null = null
    if (communeRaw) {
      communeId = communeMap.get(`${wilayaId}:${communeRaw.toLowerCase().trim()}`) ?? null
      if (!communeId) {
        errors.push({ row: rowNum, reason: `Commune introuvable: "${communeRaw}" (${wilayaRaw})` })
        continue
      }
    }

    // ── Products ───────────────────────────────────────────────────────────────

    const skuList   = productSkus.split(sep).map(s => s.trim()).filter(Boolean)
    const qtyList   = quantityRaw.split(sep).map(s => parseInt(s.trim()) || 1)
    const priceList = unitPriceRaw.split(sep).map(s => parseFloat(s.trim()) || 0)

    type ItemRow = { id: string; product_id: string; variant_id: null; product_name: string; sku: string; quantity: number; unit_price: number; unit_cost: number }
    const orderItems: Omit<ItemRow, 'id'>[] = []
    let rowFailed = false

    for (let si = 0; si < skuList.length; si++) {
      const sku = skuList[si]
      if (!skuCache.has(sku)) {
        const { data: prod } = await db
          .from('products')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .or(`sku.eq.${sku},barcode.eq.${sku}`)
          .is('deleted_at', null)
          .maybeSingle()
        skuCache.set(sku, prod ? { product_id: prod.id, product_name: prod.name } : null)
      }

      const prod = skuCache.get(sku)
      if (!prod) {
        errors.push({ row: rowNum, reason: `SKU introuvable: "${sku}"` })
        rowFailed = true
        break
      }

      orderItems.push({
        product_id:   prod.product_id,
        variant_id:   null,
        product_name: prod.product_name,
        sku,
        quantity:  qtyList[si]   ?? 1,
        unit_price: priceList[si] || 0,
        unit_cost:  0,
      })
    }
    if (rowFailed) continue

    // ── Upsert client ──────────────────────────────────────────────────────────

    let clientId: string
    if (clientCache.has(phone)) {
      clientId = clientCache.get(phone)!
    } else {
      const { data: existing } = await db
        .from('clients')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('phone', phone)
        .maybeSingle()

      if (existing) {
        clientId = (existing as { id: string }).id
      } else {
        clientId = uuid()
        const { error: cErr } = await db.from('clients').insert({
          id: clientId, tenant_id: tenantId,
          full_name: clientName, phone,
          phone2: phone2 || null, email: email || null,
          wilaya_id: wilayaId, commune_id: communeId, address: address || null,
        })
        if (cErr) { errors.push({ row: rowNum, reason: `Erreur client: ${cErr.message}` }); continue }
      }
      clientCache.set(phone, clientId)
    }

    // ── Insert order ───────────────────────────────────────────────────────────

    try {
      const reference = await rpc<string>('generate_order_reference', { p_boutique_id: boutiqueId })
      const delivMode = delivMethod.toLowerCase().includes('stop') ? 'stopdesk' : 'domicile'
      const subtotal  = orderItems.reduce((s, it) => s + it.unit_price * it.quantity, 0)
      const orderId   = uuid()

      const { error: oErr } = await db.from('orders').insert({
        id: orderId, boutique_id: boutiqueId, client_id: clientId,
        reference, tracking_status: 'en_confirmation',
        subtotal, delivery_fee: 0, discount: 0,
        delivery_method: delivMode as 'domicile' | 'stopdesk',
        wilaya_id: wilayaId, commune_id: communeId ?? null,
        address: address || null, phone, phone2: phone2 || null,
        referrer: referrer || null, remark: remark || null,
        source_type: 'google_sheet', sync_enabled: true,
      })

      if (oErr) { errors.push({ row: rowNum, reason: `Erreur commande: ${oErr.message}` }); continue }

      await db.from('order_items').insert(
        orderItems.map(it => ({ id: uuid(), order_id: orderId, ...it }))
      )

      await db.from('order_logs').insert({
        id: uuid(), order_id: orderId, user_id: userId,
        action: 'created', new_values: { source: 'google_sheet_sync' },
      })

      imported++
    } catch (err: unknown) {
      errors.push({ row: rowNum, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  return { imported, skipped, failed: errors.length, errors, last_row: newLastRow }
}

/** Exchange a refresh token for a fresh access token */
export async function getAccessToken(refreshToken: string): Promise<string> {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  )
  oauth2.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauth2.refreshAccessToken()
  return credentials.access_token ?? ''
}
