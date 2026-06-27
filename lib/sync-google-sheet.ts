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
  const rawTab = sheetName || 'Sheet1'
  // Quote tab name if it contains spaces or apostrophes
  const tab    = rawTab.includes(' ') || rawTab.includes("'")
    ? `'${rawTab.replace(/'/g, "\\'")}'`
    : rawTab

  // Read header + ALL data rows. Row-only ranges so column count doesn't matter
  // (ZZ6 fails on narrow sheets). Reading everything lets us detect truncation:
  // the row counter assumes append-only, so if rows are deleted from the sheet
  // it gets stuck ahead of reality and skips every future append.
  const [headerRes, allRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tab}!1:1` }),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tab}!2:${MAX_ROWS + 1}` }),
  ])

  const headerRow = ((headerRes.data.values ?? [])[0] ?? []) as string[]
  const headers   = headerRow.map((h: string) => String(h ?? '').trim())
  if (headers.length === 0) {
    return { imported: 0, skipped: 0, failed: 0, errors: [], last_row: startRow }
  }

  const allDataRows = (allRes.data.values ?? []) as string[][]
  const currentCount = allDataRows.length          // data rows currently in the sheet

  // How many data rows we believe we already processed (startRow counts header).
  let processed   = Math.max(0, startRow - 1)
  let recovery    = false
  if (processed > currentCount) {
    // Counter is ahead of the sheet → rows were deleted/sheet rebuilt.
    // Reprocess from the top, but skip any row that already produced an order
    // (matched by phone+subtotal, incl. soft-deleted) so we neither lose new
    // rows nor resurrect intentionally-deleted ones.
    processed = 0
    recovery  = true
  }

  // last_row always reflects the sheet's true length (header + current data).
  const newLastRow = 1 + currentCount

  const dataRows = allDataRows.slice(processed).filter(r => r.some(c => String(c ?? '').trim()))
  if (dataRows.length === 0) {
    return { imported: 0, skipped: 0, failed: 0, errors: [], last_row: newLastRow }
  }

  // In recovery, preload existing order signatures to avoid duplicates / resurrections.
  const existingSig = new Set<string>()
  if (recovery) {
    const { data: ex } = await db
      .from('orders')
      .select('phone, subtotal')
      .eq('boutique_id', boutiqueId)
    for (const o of (ex ?? []) as { phone: string; subtotal: number }[]) {
      existingSig.add(`${String(o.phone ?? '').trim()}|${Number(o.subtotal)}`)
    }
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
    const rowNum = processed + ri + 2  // absolute sheet row number (1=header)
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
      const subtotal  = orderItems.reduce((s, it) => s + it.unit_price * it.quantity, 0)

      // Recovery mode: skip rows that already produced an order (live or deleted)
      if (recovery && existingSig.has(`${phone}|${subtotal}`)) { skipped++; continue }

      const reference = await rpc<string>('generate_order_reference', { p_boutique_id: boutiqueId })
      const delivMode = delivMethod.toLowerCase().includes('stop') ? 'stopdesk' : 'domicile'
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

// ── Drive push-notification helpers ───────────────────────────────────────────

export interface WatchInfo {
  channelId:  string
  resourceId: string
  expiration: number   // ms since epoch
}

/**
 * Register a Drive push-notification channel so Google POSTs to webhookUrl
 * whenever the spreadsheet changes. Returns channel info to store in creds.
 * Expiration: up to 7 days for Workspace files (Sheets).
 */
export async function registerDriveWatch(
  accessToken: string,
  sheetId:     string,
  webhookUrl:  string,
  channelId:   string
): Promise<WatchInfo> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive  = google.drive({ version: 'v3', auth })
  const expMs  = Date.now() + 7 * 24 * 60 * 60 * 1000   // 7 days
  const res    = await drive.files.watch({
    fileId: sheetId,
    requestBody: {
      kind:       'api#channel',
      id:         channelId,
      type:       'web_hook',
      address:    webhookUrl,
      expiration: String(expMs),
    },
  })
  return {
    channelId:  res.data.id         ?? channelId,
    resourceId: res.data.resourceId ?? '',
    expiration: Number(res.data.expiration ?? expMs),
  }
}

/**
 * Stop (unsubscribe) a Drive push-notification channel.
 */
export async function stopDriveWatch(
  accessToken: string,
  channelId:   string,
  resourceId:  string
): Promise<void> {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })
  await drive.channels.stop({ requestBody: { id: channelId, resourceId } })
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

const SYNC_LOCK_MS = 45_000  // skip if another sync started within this window

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SourceRow = any

/**
 * Sync one source end-to-end with a soft lock so concurrent triggers
 * (frontend poll + Drive webhook + cron) never double-import the same rows.
 * Returns null if skipped (locked / no token), otherwise the SyncResult.
 */
export async function syncSourceWithLock(
  source:   SourceRow,
  tenantId: string,
  userId:   string,
): Promise<SyncResult | null> {
  let creds: { refresh_token?: string; last_row?: number; sync_lock?: number } = {}
  try { creds = JSON.parse(source.credentials_ref ?? '{}') } catch { /* ignore */ }

  if (!creds.refresh_token) return null

  // Soft lock — bail if a sync started very recently
  if (creds.sync_lock && Date.now() - creds.sync_lock < SYNC_LOCK_MS) return null

  // Claim the lock
  const locked = { ...creds, sync_lock: Date.now() }
  await db.from('import_sources').update({ credentials_ref: JSON.stringify(locked) }).eq('id', source.id)

  const runId = uuid()
  try {
    await db.from('import_runs').insert({
      id: runId, import_source_id: source.id,
      rows_total: 0, rows_imported: 0, rows_failed: 0, status: 'running', errors: [],
    })

    const accessToken = await getAccessToken(creds.refresh_token)
    const result = await syncGoogleSheet({
      accessToken,
      sheetId:    source.sheet_id,
      sheetName:  source.sheet_name ?? 'Sheet1',
      separator:  source.separator  ?? '|',
      boutiqueId: source.boutique_id,
      mapping:    source.column_mapping ?? {},
      startRow:   creds.last_row ?? 1,
      tenantId,
      userId,
    })

    // Persist new last_row and release lock
    const next = { ...creds, last_row: result.last_row, sync_lock: 0 }
    await db.from('import_sources').update({
      credentials_ref: JSON.stringify(next),
      last_synced_at:  new Date().toISOString(),
    }).eq('id', source.id)

    await db.from('import_runs').update({
      rows_total:    result.imported + result.skipped + result.failed,
      rows_imported: result.imported,
      rows_failed:   result.failed,
      status:        result.failed > 0 ? 'partial' : 'completed',
      errors:        result.errors,
    }).eq('id', runId)

    return result
  } catch (err) {
    // Release lock even on failure
    await db.from('import_sources').update({
      credentials_ref: JSON.stringify({ ...creds, sync_lock: 0 }),
    }).eq('id', source.id)
    const msg = err instanceof Error ? err.message : String(err)
    await db.from('import_runs').update({ status: 'failed', errors: [{ reason: msg }] }).eq('id', runId)
    return null
  }
}
