const BASE_URL   = process.env.NOEST_BASE_URL  ?? 'https://app.noest-dz.com'
const API_TOKEN  = process.env.NOEST_API_TOKEN ?? ''
const USER_GUID  = process.env.NOEST_USER_GUID ?? ''

async function call(path: string, init: RequestInit = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization:  `Bearer ${API_TOKEN}`,
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

export async function noestCreateOrder(payload: NoestCreatePayload): Promise<NoestCreateResult> {
  const res = await call('/api/public/create/order', {
    method: 'POST',
    body:   JSON.stringify({ user_guid: USER_GUID, ...payload }),
  })
  return res.json()
}

export async function noestValidateOrder(tracking: string): Promise<NoestValidateResult> {
  const res = await call('/api/public/valid/order', {
    method: 'POST',
    body:   JSON.stringify({ user_guid: USER_GUID, tracking }),
  })
  return res.json()
}

export async function noestDeleteOrder(tracking: string): Promise<{ success: boolean }> {
  const res = await call('/api/public/delete/order', {
    method: 'POST',
    body:   JSON.stringify({ user_guid: USER_GUID, tracking }),
  })
  return res.json()
}

export async function noestRequestReturn(tracking: string): Promise<{ success: boolean }> {
  const res = await call('/api/public/ask/return', {
    method: 'POST',
    body:   JSON.stringify({ tracking }),
  })
  return res.json()
}

export async function noestRequestNewAttempt(tracking: string): Promise<{ success: boolean }> {
  const res = await call('/api/public/ask/new-tentative', {
    method: 'POST',
    body:   JSON.stringify({ tracking }),
  })
  return res.json()
}

export async function noestGetTrackingInfo(
  trackings: string[],
): Promise<Record<string, NoestTrackingResult>> {
  const res = await call('/api/public/get/trackings/info', {
    method: 'POST',
    body:   JSON.stringify({ trackings }),
  })
  return res.json()
}

export async function noestGetLabelResponse(tracking: string): Promise<Response> {
  return call(`/api/public/get/order/label?tracking=${encodeURIComponent(tracking)}`, {
    method:  'GET',
    headers: { 'Content-Type': '' },
  })
}
