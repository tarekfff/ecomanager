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
  last_row:  number    // sheet length (header + data) — informational, for the UI
  keyed:     boolean   // true once dedup-key tracking has been bootstrapped
}

interface SyncParams {
  accessToken:   string
  sheetId:       string
  sheetName:     string
  separator:     string
  boutiqueId:    string
  mapping:       SheetMapping
  tenantId:      string
  userId:        string
  keyedAlready?: boolean   // true if this source already records dedup keys
}

// ── Small utilities ────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** order_logs.user_id is a UUID FK — coerce non-UUID actors (cron/webhook) to null */
function asUserId(v: string): string | null {
  return UUID_RE.test(v) ? v : null
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function cell(row: string[], headers: string[], col: string): string {
  if (!col) return ''
  const idx = headers.indexOf(col)
  return idx >= 0 ? String(row[idx] ?? '').trim() : ''
}

// ── Core sync ───────────────────────────────────────────────────────────────────
//
// Idempotent + batched. Reads the whole sheet window (one API call), then resolves
// products / clients / existing-orders in BULK (a handful of queries total instead
// of ~6 per row). Each imported row records a stable `sheet_key` in its creation
// log; the next run skips any row whose key already exists, so re-running, crashes,
// reordering (new rows added at top OR bottom) and Google's duplicate webhooks can
// never double-import — and repeat orders from the same customer still import
// because the key is the sheet's order number, not phone+amount.

export async function syncGoogleSheet(params: SyncParams): Promise<SyncResult> {
  const {
    accessToken, sheetId, sheetName, separator, boutiqueId, mapping, tenantId, userId,
  } = params
  const keyedAlready = !!params.keyedAlready
  const logUserId    = asUserId(userId)

  // ── 1. Read sheet (header + data in one round-trip) ───────────────────────────
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const sheets = google.sheets({ version: 'v4', auth })
  const rawTab = sheetName || 'Sheet1'
  const tab    = rawTab.includes(' ') || rawTab.includes("'")
    ? `'${rawTab.replace(/'/g, "\\'")}'`
    : rawTab

  const [headerRes, allRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tab}!1:1` }),
    sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${tab}!2:${MAX_ROWS + 1}` }),
  ])

  const headers     = (((headerRes.data.values ?? [])[0] ?? []) as string[]).map(h => String(h ?? '').trim())
  const allDataRows = (allRes.data.values ?? []) as string[][]
  const newLastRow  = 1 + allDataRows.length

  const empty = (extra?: Partial<SyncResult>): SyncResult => ({
    imported: 0, skipped: 0, failed: 0, errors: [], last_row: newLastRow, keyed: keyedAlready, ...extra,
  })
  if (headers.length === 0) return empty({ last_row: 1 })

  const dataRows = allDataRows.filter(r => r.some(c => String(c ?? '').trim()))
  if (dataRows.length === 0) return empty()

  // ── 2. Reference lookups (wilayas + communes) ────────────────────────────────
  const [{ data: wilayaData }, { data: communeData }] = await Promise.all([
    db.from('wilayas').select('id, name'),
    db.from('communes').select('id, name, wilaya_id'),
  ])
  const wilayaMap = new Map<string, number>()
  for (const w of (wilayaData ?? []) as { id: number; name: string }[]) {
    wilayaMap.set(w.name.toLowerCase().trim(), w.id)
  }
  const communeMap = new Map<string, number>()
  for (const c of (communeData ?? []) as { id: number; name: string; wilaya_id: number }[]) {
    communeMap.set(`${c.wilaya_id}:${c.name.toLowerCase().trim()}`, c.id)
  }

  // ── 3. Parse + validate every row into a candidate ───────────────────────────
  const sep    = separator || '|'
  const errors: { row: number; reason: string }[] = []

  type Item = { sku: string; quantity: number; unit_price: number }
  interface Candidate {
    rowNum: number; dedupKey: string; orderRef: string
    clientName: string; phone: string; phone2: string; email: string
    wilayaId: number; communeId: number | null; address: string
    remark: string; referrer: string; delivMode: 'domicile' | 'stopdesk'
    items: Item[]; subtotal: number
  }
  const candidates: Candidate[] = []
  const allSkus = new Set<string>()

  for (let ri = 0; ri < dataRows.length; ri++) {
    const rowNum = ri + 2
    const row    = dataRows[ri]

    const clientName  = cell(row, headers, mapping.client_name)
    const phone       = cell(row, headers, mapping.phone)
    const wilayaRaw   = cell(row, headers, mapping.wilaya)
    const productSkus = cell(row, headers, mapping.product_sku)

    if (!clientName)  { errors.push({ row: rowNum, reason: 'Nom client manquant' });   continue }
    if (!phone)       { errors.push({ row: rowNum, reason: 'Téléphone manquant' });     continue }
    if (!wilayaRaw)   { errors.push({ row: rowNum, reason: 'Wilaya manquante' });       continue }
    if (!productSkus) { errors.push({ row: rowNum, reason: 'SKU produit manquant' });   continue }

    let wilayaId: number | null = wilayaMap.get(wilayaRaw.toLowerCase().trim()) ?? null
    if (!wilayaId) {
      const n = parseInt(wilayaRaw.trim())
      if (!isNaN(n) && n >= 1 && n <= 58) wilayaId = n
    }
    if (!wilayaId) { errors.push({ row: rowNum, reason: `Wilaya introuvable: "${wilayaRaw}"` }); continue }

    const communeRaw = cell(row, headers, mapping.commune)
    let communeId: number | null = null
    if (communeRaw) {
      communeId = communeMap.get(`${wilayaId}:${communeRaw.toLowerCase().trim()}`) ?? null
      if (!communeId) { errors.push({ row: rowNum, reason: `Commune introuvable: "${communeRaw}" (${wilayaRaw})` }); continue }
    }

    const skuList   = productSkus.split(sep).map(s => s.trim()).filter(Boolean)
    const qtyList   = cell(row, headers, mapping.quantity).split(sep).map(s => parseInt(s.trim()) || 1)
    const priceList = cell(row, headers, mapping.unit_price).split(sep).map(s => parseFloat(s.trim()) || 0)
    const items: Item[] = skuList.map((sku, i) => ({ sku, quantity: qtyList[i] ?? 1, unit_price: priceList[i] || 0 }))
    for (const it of items) allSkus.add(it.sku)
    const subtotal = items.reduce((s, it) => s + it.unit_price * it.quantity, 0)

    const orderRef  = cell(row, headers, mapping.order_ref)
    const delivMode = cell(row, headers, mapping.delivery_method).toLowerCase().includes('stop') ? 'stopdesk' : 'domicile'
    // Stable identity for dedup: prefer the sheet's order number, else a content signature
    const dedupKey  = orderRef ? `ref:${orderRef}` : `sig:${phone}|${subtotal}|${skuList.join('+')}`

    candidates.push({
      rowNum, dedupKey, orderRef,
      clientName, phone,
      phone2:  cell(row, headers, mapping.phone2),
      email:   cell(row, headers, mapping.email),
      wilayaId, communeId,
      address: cell(row, headers, mapping.address),
      remark:  cell(row, headers, mapping.remark),
      referrer: cell(row, headers, mapping.referrer),
      delivMode, items, subtotal,
    })
  }
  if (candidates.length === 0) return empty({ failed: errors.length, errors })

  // ── 4. Bulk-resolve products (sku → barcode → exact name → ilike name) ────────
  const skuToProduct = new Map<string, { product_id: string; product_name: string }>()
  const skuArr = [...allSkus]

  for (const part of chunk(skuArr, 150)) {
    const { data } = await db.from('products').select('id, name, sku')
      .eq('tenant_id', tenantId).is('deleted_at', null).in('sku', part)
    for (const p of (data ?? []) as { id: string; name: string; sku: string | null }[]) {
      if (p.sku) skuToProduct.set(p.sku, { product_id: p.id, product_name: p.name })
    }
  }
  let pending = skuArr.filter(s => !skuToProduct.has(s))
  for (const part of chunk(pending, 150)) {
    const { data } = await db.from('products').select('id, name, barcode')
      .eq('tenant_id', tenantId).is('deleted_at', null).in('barcode', part)
    for (const p of (data ?? []) as { id: string; name: string; barcode: string | null }[]) {
      if (p.barcode) skuToProduct.set(p.barcode, { product_id: p.id, product_name: p.name })
    }
  }
  pending = skuArr.filter(s => !skuToProduct.has(s))
  for (const part of chunk(pending, 150)) {
    const { data } = await db.from('products').select('id, name')
      .eq('tenant_id', tenantId).is('deleted_at', null).in('name', part)
    for (const p of (data ?? []) as { id: string; name: string }[]) {
      if (allSkus.has(p.name)) skuToProduct.set(p.name, { product_id: p.id, product_name: p.name })
    }
  }
  // case-insensitive name fallback for the few still unresolved
  for (const s of skuArr.filter(x => !skuToProduct.has(x))) {
    const { data } = await db.from('products').select('id, name')
      .eq('tenant_id', tenantId).is('deleted_at', null).ilike('name', s).maybeSingle()
    if (data) skuToProduct.set(s, { product_id: (data as { id: string }).id, product_name: (data as { name: string }).name })
  }

  type Resolved = { product_id: string; variant_id: null; product_name: string; sku: string; quantity: number; unit_price: number; unit_cost: number }
  const ready: (Candidate & { resolvedItems: Resolved[] })[] = []
  for (const c of candidates) {
    const resolvedItems: Resolved[] = []
    let ok = true
    for (const it of c.items) {
      const p = skuToProduct.get(it.sku)
      if (!p) { errors.push({ row: c.rowNum, reason: `SKU introuvable: "${it.sku}"` }); ok = false; break }
      resolvedItems.push({ product_id: p.product_id, variant_id: null, product_name: p.product_name, sku: it.sku, quantity: it.quantity, unit_price: it.unit_price, unit_cost: 0 })
    }
    if (ok) ready.push({ ...c, resolvedItems })
  }
  if (ready.length === 0) return empty({ failed: errors.length, errors })

  // ── 5. Dedup against already-imported rows ───────────────────────────────────
  // Primary: sheet_key recorded on each order's creation log. Bounded by the keys
  // present in the sheet (≤ MAX_ROWS), so it stays cheap as the table grows.
  const allKeys = [...new Set(ready.map(r => r.dedupKey))]
  const existingKeys = new Set<string>()
  let keyLookupOk = true
  for (const part of chunk(allKeys, 150)) {
    const { data, error } = await db
      .from('order_logs')
      .select('new_values, orders!inner(boutique_id)')
      .eq('orders.boutique_id', boutiqueId)
      .eq('action', 'created')
      .in('new_values->>sheet_key', part)
    if (error) { keyLookupOk = false; continue }
    for (const r of (data ?? []) as { new_values: { sheet_key?: string } | null }[]) {
      const k = r?.new_values?.sheet_key
      if (k) existingKeys.add(k)
    }
  }

  // Signature guard (phone+subtotal). Used as a safety net so we can never
  // mass-duplicate when (a) bootstrapping a source whose legacy orders have no
  // dedup key yet, or (b) the key lookup itself failed. Skipped once keys are
  // tracked AND the lookup succeeded, so repeat orders import normally.
  const useSigGuard = !keyedAlready || !keyLookupOk
  const existingSig = new Set<string>()
  if (useSigGuard) {
    const { data } = await db.from('orders').select('phone, subtotal').eq('boutique_id', boutiqueId)
    for (const o of (data ?? []) as { phone: string; subtotal: number }[]) {
      existingSig.add(`${String(o.phone ?? '').trim()}|${Number(o.subtotal)}`)
    }
  }

  const seen = new Set<string>()
  const toImport: typeof ready = []
  let skipped = 0
  for (const r of ready) {
    if (existingKeys.has(r.dedupKey)) { skipped++; continue }
    if (seen.has(r.dedupKey))         { skipped++; continue }   // duplicate ref within the same sheet
    if (useSigGuard && existingSig.has(`${r.phone}|${r.subtotal}`)) { skipped++; continue }
    seen.add(r.dedupKey)
    toImport.push(r)
  }
  if (toImport.length === 0) return empty({ skipped, failed: errors.length, errors, keyed: keyLookupOk })

  // ── 6. Bulk-resolve / create clients (one lookup, one insert) ────────────────
  const phones = [...new Set(toImport.map(r => r.phone))]
  const phoneToClient = new Map<string, string>()
  for (const part of chunk(phones, 150)) {
    const { data } = await db.from('clients').select('id, phone').eq('tenant_id', tenantId).in('phone', part)
    for (const c of (data ?? []) as { id: string; phone: string }[]) phoneToClient.set(c.phone, c.id)
  }
  // Most-recent sheet data per phone wins (first occurrence — sheet is newest-first)
  const phoneData = new Map<string, Candidate>()
  for (const r of toImport) if (!phoneData.has(r.phone)) phoneData.set(r.phone, r)

  const newClientRows: Record<string, unknown>[] = []
  const existingPhones: string[] = []
  for (const phone of phones) {
    const d = phoneData.get(phone)!
    if (phoneToClient.has(phone)) {
      existingPhones.push(phone)
    } else {
      const id = uuid()
      phoneToClient.set(phone, id)
      newClientRows.push({
        id, tenant_id: tenantId, full_name: d.clientName, phone,
        phone2: d.phone2 || null, email: d.email || null,
        wilaya_id: d.wilayaId, commune_id: d.communeId, address: d.address || null,
      })
    }
  }
  if (newClientRows.length) {
    const { error } = await db.from('clients').insert(newClientRows)
    if (error) for (const c of newClientRows) await db.from('clients').insert(c)  // isolate bad row
  }
  // Refresh existing clients with latest sheet data (bounded by distinct phones)
  for (const phone of existingPhones) {
    const d = phoneData.get(phone)!
    await db.from('clients').update({
      full_name: d.clientName, phone2: d.phone2 || null, email: d.email || null,
      wilaya_id: d.wilayaId, commune_id: d.communeId || null, address: d.address || null,
    }).eq('id', phoneToClient.get(phone)!)
  }

  // ── 7. Build + bulk-insert orders, items, logs ───────────────────────────────
  // References must come from the DB sequence function (atomic per call).
  interface OrderRow { id: string; ref: string; cand: typeof toImport[number] }
  const built: OrderRow[] = []
  for (const cand of toImport) {
    const ref = await rpc<string>('generate_order_reference', { p_boutique_id: boutiqueId })
    built.push({ id: uuid(), ref, cand })
  }

  const orderRows = built.map(({ id, ref, cand }) => ({
    id, boutique_id: boutiqueId, client_id: phoneToClient.get(cand.phone)!,
    reference: ref, tracking_status: 'en_confirmation',
    subtotal: cand.subtotal, delivery_fee: 0, discount: 0,
    delivery_method: cand.delivMode,
    wilaya_id: cand.wilayaId, commune_id: cand.communeId ?? null,
    address: cand.address || null, phone: cand.phone, phone2: cand.phone2 || null,
    referrer: cand.referrer || null, remark: cand.remark || null,
    source_type: 'google_sheet', sync_enabled: true,
  }))

  // Insert orders — bulk first, fall back to per-row to isolate a single failure
  const insertedIds = new Set<string>()
  const bulk = await db.from('orders').insert(orderRows).select('id')
  if (!bulk.error) {
    for (const o of (bulk.data ?? []) as { id: string }[]) insertedIds.add(o.id)
  } else {
    for (const row of orderRows) {
      const { error } = await db.from('orders').insert(row)
      if (error) {
        const b = built.find(x => x.id === row.id)!
        errors.push({ row: b.cand.rowNum, reason: `Erreur commande: ${error.message}` })
      } else {
        insertedIds.add(row.id as string)
      }
    }
  }

  const okBuilt = built.filter(b => insertedIds.has(b.id))

  const itemRows = okBuilt.flatMap(b => b.cand.resolvedItems.map(it => ({ id: uuid(), order_id: b.id, ...it })))
  if (itemRows.length) {
    const r = await db.from('order_items').insert(itemRows)
    if (r.error) for (const it of itemRows) await db.from('order_items').insert(it)
  }

  const logRows = okBuilt.map(b => ({
    id: uuid(), order_id: b.id, user_id: logUserId, action: 'created',
    new_values: { source: 'google_sheet_sync', sheet_key: b.cand.dedupKey, sheet_ref: b.cand.orderRef || null },
  }))
  if (logRows.length) {
    const r = await db.from('order_logs').insert(logRows)
    if (r.error) for (const l of logRows) await db.from('order_logs').insert(l)  // logs carry the dedup key — must persist
  }

  return {
    imported: okBuilt.length,
    skipped,
    failed: errors.length,
    errors,
    last_row: newLastRow,
    keyed: keyLookupOk,
  }
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

// Crash-recovery timeout: a normal sync releases its lock the instant it
// finishes, so this only matters if a run dies mid-sync. Set well above the
// longest possible sync so a healthy run is never stolen.
const SYNC_STALE_MS = 120_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SourceRow = any

/**
 * Sync one source end-to-end behind a HELD atomic lock (sync_locked_at).
 *
 * Acquire is a compare-and-swap: a single conditional UPDATE that only one
 * concurrent caller can win (Postgres serializes the row update), so cron,
 * Drive push (incl. Google's duplicate ~50ms-apart notifications), manual
 * "Sync now", and on-open triggers can never double-import.
 *
 * The lock is held only WHILE the sync runs and released in `finally`, so an
 * on-open sync is blocked only if a sync is literally in progress (~2-5s) —
 * never for a fixed window. Returns null if skipped (lock not won / no token).
 */
export async function syncSourceWithLock(
  source:   SourceRow,
  tenantId: string,
  userId:   string,
): Promise<SyncResult | null> {
  let creds: {
    refresh_token?: string; last_row?: number; prepend_mode?: boolean
    access_token?: string; access_token_expiry?: number; keyed?: boolean
  } = {}
  try { creds = JSON.parse(source.credentials_ref ?? '{}') } catch { /* ignore */ }

  if (!creds.refresh_token) return null

  // ── Acquire lock (atomic CAS) ───────────────────────────────────────────
  // Win only if not currently locked, or the lock is stale (crashed run).
  // Held lock via sync_locked_at (released in finally) gives instant on-open
  // syncs. If that column hasn't been added yet, fall back to a last_synced_at
  // CAS so syncing keeps working — auto-upgrades once the column exists.
  const now         = new Date().toISOString()
  const staleCutoff = new Date(Date.now() - SYNC_STALE_MS).toISOString()
  let heldLock      = true

  const lockRes = await db
    .from('import_sources')
    .update({ sync_locked_at: now })
    .eq('id', source.id)
    .or(`sync_locked_at.is.null,sync_locked_at.lt.${staleCutoff}`)
    .select('id')

  let claimed = lockRes.data
  if (lockRes.error) {
    // Column missing — fall back to time-window CAS on last_synced_at (45s)
    heldLock = false
    const winCutoff = new Date(Date.now() - 45_000).toISOString()
    const fb = await db
      .from('import_sources')
      .update({ last_synced_at: now })
      .eq('id', source.id)
      .or(`last_synced_at.is.null,last_synced_at.lt.${winCutoff}`)
      .select('id')
    claimed = fb.data
  }

  if (!claimed || claimed.length === 0) return null   // a sync is already running

  const runId = uuid()
  try {
    await db.from('import_runs').insert({
      id: runId, import_source_id: source.id,
      rows_total: 0, rows_imported: 0, rows_failed: 0, status: 'running', errors: [],
    })

    // Reuse cached access token if still valid (>60s remaining), otherwise refresh.
    // Google tokens last ~1h; refreshing every sync would exhaust the rate limit.
    let accessToken: string
    if (creds.access_token && (creds.access_token_expiry ?? 0) > Date.now() + 60_000) {
      accessToken = creds.access_token
    } else {
      accessToken = await getAccessToken(creds.refresh_token)
      creds = { ...creds, access_token: accessToken, access_token_expiry: Date.now() + 55 * 60 * 1000 }
    }

    const result = await syncGoogleSheet({
      accessToken,
      sheetId:      source.sheet_id,
      sheetName:    source.sheet_name ?? 'Sheet1',
      separator:    source.separator  ?? '|',
      boutiqueId:   source.boutique_id,
      mapping:      source.column_mapping ?? {},
      tenantId,
      userId,
      keyedAlready: !!creds.keyed,
    })

    const next = { ...creds, last_row: result.last_row, keyed: result.keyed || creds.keyed }
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
    const msg = err instanceof Error ? err.message : String(err)
    await db.from('import_runs').update({ status: 'failed', errors: [{ reason: msg }] }).eq('id', runId)
    return null
  } finally {
    // Release immediately so an on-open sync isn't blocked by the cron.
    // (Fallback path has no held lock — its 45s window self-expires.)
    if (heldLock) {
      await db.from('import_sources').update({ sync_locked_at: null }).eq('id', source.id)
    }
  }
}
