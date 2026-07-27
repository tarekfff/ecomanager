const BASE_URL   = process.env.NOEST_BASE_URL  ?? 'https://app.noest-dz.com'
const API_TOKEN  = process.env.NOEST_API_TOKEN ?? ''
const USER_GUID  = process.env.NOEST_USER_GUID ?? ''

// Per-tenant NOEST credentials. When omitted, the module falls back to the shared
// env-var account (legacy behaviour) so existing callers keep working unchanged.
export interface NoestCreds {
  baseUrl?: string
  token?:   string
  guid?:    string
}

function guidOf(creds?: NoestCreds): string {
  return creds?.guid || USER_GUID
}

// Strip spaces, +213 prefix → 0XXX format expected by NOEST (9-10 digits)
export function normalizePhone(phone: string): string {
  let p = phone.replace(/\s+/g, '').replace(/[^0-9+]/g, '')
  if (p.startsWith('+213')) p = '0' + p.slice(4)
  else if (p.startsWith('213')) p = '0' + p.slice(3)
  return p
}

async function call(path: string, init: RequestInit = {}, creds?: NoestCreds) {
  const base  = creds?.baseUrl || BASE_URL
  const token = creds?.token   || API_TOKEN
  return fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface NoestCreatePayload {
  reference?: string
  client:     string
  phone:      string
  phone_2?:   string
  adresse:    string
  wilaya_id:  number
  commune:    string
  montant:    number
  remarque?:  string
  produit:    string
  type_id:    1 | 2 | 3
  stop_desk:  0 | 1
  station_code?: string
  poids?:     number
}

export interface NoestCreateResult {
  success:            boolean
  tracking?:          string
  reference?:         string
  regional_hub_name?: string
  wilaya_rank?:       string
  [key: string]:      unknown
}

export interface NoestValidateResult {
  success: boolean
  [key: string]: unknown
}

export interface NoestTrackingActivity {
  event:         string
  event_key?:    string
  causer:        string
  by:            string
  date:          string
  driver?:       string
}

export interface NoestTrackingResult {
  OrderInfo?:         Record<string, unknown>
  activity?:          NoestTrackingActivity[]
  deliveryAttempts?:  unknown[]
}

// ── API wrappers ───────────────────────────────────────────────────────────────

export async function noestCreateOrder(payload: NoestCreatePayload, creds?: NoestCreds): Promise<NoestCreateResult> {
  const res = await call('/api/public/create/order', {
    method: 'POST',
    body:   JSON.stringify({ user_guid: guidOf(creds), ...payload }),
  }, creds)
  return res.json()
}

export async function noestValidateOrder(tracking: string, creds?: NoestCreds): Promise<NoestValidateResult> {
  const res = await call('/api/public/valid/order', {
    method: 'POST',
    body:   JSON.stringify({ user_guid: guidOf(creds), tracking }),
  }, creds)
  return res.json()
}

export async function noestDeleteOrder(tracking: string, creds?: NoestCreds): Promise<{ success: boolean }> {
  const res = await call('/api/public/delete/order', {
    method: 'POST',
    body:   JSON.stringify({ user_guid: guidOf(creds), tracking }),
  }, creds)
  return res.json()
}

export async function noestRequestReturn(tracking: string, creds?: NoestCreds): Promise<{ success: boolean }> {
  const res = await call('/api/public/ask/return', {
    method: 'POST',
    body:   JSON.stringify({ tracking }),
  }, creds)
  return res.json()
}

export async function noestRequestNewAttempt(tracking: string, creds?: NoestCreds): Promise<{ success: boolean }> {
  const res = await call('/api/public/ask/new-tentative', {
    method: 'POST',
    body:   JSON.stringify({ tracking }),
  }, creds)
  return res.json()
}

export async function noestGetTrackingInfo(
  trackings: string[],
  creds?: NoestCreds,
): Promise<Record<string, NoestTrackingResult>> {
  const res = await call('/api/public/get/trackings/info', {
    method: 'POST',
    body:   JSON.stringify({ trackings }),
  }, creds)
  return res.json()
}

export async function noestGetLabelResponse(tracking: string, creds?: NoestCreds): Promise<Response> {
  return fetch(`${creds?.baseUrl || BASE_URL}/api/public/get/order/label?tracking=${encodeURIComponent(tracking)}`, {
    headers: { Authorization: `Bearer ${creds?.token || API_TOKEN}` },
  })
}

// ── Bulk create / validate (PDF §2, §4) ──────────────────────────────────────────

export async function noestCreateOrders(orders: NoestCreatePayload[]): Promise<unknown> {
  const res = await call('/api/public/create/orders', {
    method: 'POST',
    body:   JSON.stringify({ user_guid: USER_GUID, orders }),
  })
  return res.json()
}

export async function noestValidateOrders(trackings: string[]): Promise<unknown> {
  const res = await call('/api/public/valid/orders', {
    method: 'POST',
    body:   JSON.stringify({ user_guid: USER_GUID, trackings }),
  })
  return res.json()
}

// ── Update an order (PDF §5 and §5.1) ────────────────────────────────────────────

export interface NoestUpdatePayload {
  tracking:     string
  tel?:         string
  tel2?:        string
  client?:      string
  reference?:   string
  adresse?:     string
  wilaya?:      number
  commune?:     string
  montant?:     number
  remarque?:    string
  product?:     string
  type?:        1 | 2 | 3
  poids?:       number
  stop_desk?:   0 | 1
  code_station?: string
}

/** §5 — modification request (allowed once shipped: only type & montant). */
export async function noestUpdateOrder(payload: NoestUpdatePayload, creds?: NoestCreds): Promise<{ success: boolean; message?: string }> {
  const res = await call('/api/public/update/order', {
    method: 'POST',
    body:   JSON.stringify(payload),
  }, creds)
  return res.json()
}

/** §5.1 — direct edit before expedition (applies immediately). */
export async function noestUpdateOrderBeforeExpedition(payload: NoestUpdatePayload, creds?: NoestCreds): Promise<{ success: boolean; message?: string }> {
  const res = await call('/api/public/update/order/before/expedition', {
    method: 'POST',
    body:   JSON.stringify(payload),
  }, creds)
  return res.json()
}

// ── Add a remark (PDF §7) ────────────────────────────────────────────────────────

export async function noestAddRemark(tracking: string, content: string): Promise<{ success: boolean; message?: string }> {
  const res = await call('/api/public/add/maj', {
    method: 'POST',
    body:   JSON.stringify({ tracking, content }),
  })
  return res.json()
}

// ── Reference data (PDF §12–15) ──────────────────────────────────────────────────

export async function noestGetDesks(creds?: NoestCreds): Promise<unknown> {
  const res = await call('/api/public/desks', { method: 'GET' }, creds)
  return res.json()
}

export async function noestGetFees(creds?: NoestCreds): Promise<unknown> {
  const res = await call('/api/public/fees', { method: 'GET' }, creds)
  return res.json()
}

export async function noestGetCommunes(wilayaId?: number, creds?: NoestCreds): Promise<unknown> {
  const path = wilayaId ? `/api/public/get/communes/${wilayaId}` : '/api/public/get/communes'
  const res  = await call(path, { method: 'GET' }, creds)
  return res.json()
}

export async function noestGetWilayas(creds?: NoestCreds): Promise<unknown> {
  const res = await call('/api/public/get/wilayas', { method: 'GET' }, creds)
  return res.json()
}

// ── Connectivity test (read-only, non-destructive) ───────────────────────────────
// Calls a read-only NOEST endpoint to verify the API token + user_guid work
// without creating or mutating anything on NOEST's side.
export interface NoestPingResult {
  ok:       boolean
  status:   number
  wilayas?: number      // count returned on success
  body?:    string      // raw body on failure (truncated)
}

export async function noestPing(creds?: NoestCreds): Promise<NoestPingResult> {
  try {
    const res = await call('/api/public/get/wilayas', { method: 'GET' }, creds)
    const text = await res.text()
    if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 500) }
    let count: number | undefined
    try { const j = JSON.parse(text); if (Array.isArray(j)) count = j.length } catch { /* ignore */ }
    return { ok: true, status: res.status, wilayas: count }
  } catch (e) {
    return { ok: false, status: 0, body: String(e).slice(0, 500) }
  }
}
