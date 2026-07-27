import type { CarrierAdapter, CarrierCreds, ShipmentInput } from './types'
import { normalizeDzPhone } from './types'

// Zimou Express — https://zimou.express/api/v1 (Bearer token auth).
// Contract per the published Swagger (POST /packages). The exact tracking key in
// the response isn't documented, so we parse it tolerantly and log the raw body
// (visible in webhook logs) so any field mismatch is easy to spot and adjust.
const DEFAULT_BASE = 'https://zimou.express/api/v1'

function baseOf(creds: CarrierCreds): string {
  return (creds.baseUrl || DEFAULT_BASE).replace(/\/+$/, '')
}

async function call(creds: CarrierCreds, path: string, init: RequestInit = {}) {
  return fetch(`${baseOf(creds)}${path}`, {
    ...init,
    headers: {
      Authorization:  `Bearer ${creds.token ?? ''}`,
      'Content-Type': 'application/json',
      Accept:         'application/json',
      ...(init.headers ?? {}),
    },
  })
}

// Zimou requires separate first/last name; split on the first space.
function splitName(full: string): { first: string; last: string } {
  const parts = (full || '').trim().split(/\s+/)
  if (parts.length <= 1) return { first: parts[0] || '—', last: parts[0] || '—' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

// Find a tracking code under any of the common shapes ({tracking}, {data:{...}}, …).
function extractTracking(body: unknown): string | null {
  const keys = ['tracking', 'tracking_code', 'trackingCode', 'code', 'reference', 'id']
  const scan = (o: unknown): string | null => {
    if (!o || typeof o !== 'object') return null
    const rec = o as Record<string, unknown>
    for (const k of keys) {
      const v = rec[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
      if (typeof v === 'number') return String(v)
    }
    return null
  }
  return scan(body) ?? scan((body as { data?: unknown })?.data) ?? null
}

// Field set verified against the live v1 API (2026-07-26). Required by validation:
// name, client_first_name, client_last_name, client_phone, address, order_id,
// price, type, free_delivery. commune/wilaya/weight are accepted and echoed back.
// The create response returns the tracking under data.tracking_code.
function toPackage(input: ShipmentInput): Record<string, unknown> {
  const { first, last } = splitName(input.clientName)
  return {
    name:              (input.products || input.reference || 'Colis').slice(0, 255),
    client_first_name: first,
    client_last_name:  last,
    client_phone:      normalizeDzPhone(input.phone),
    client_phone2:     input.phone2 ? normalizeDzPhone(input.phone2) : '',
    address:           input.address?.trim() || input.commune || '—',
    commune:           input.commune || '',
    wilaya:            input.wilayaName || String(input.wilayaId),
    order_id:          input.reference,
    weight:            input.weightG ?? 500,
    price:             input.amount ?? 0,
    type:              1,                    // required — package category (e-commerce)
    free_delivery:     false,                // required — COD orders are not free delivery
    // Home vs stop-desk: best-effort. Zimou ignored `is_stopdesk` in testing, so the
    // exact field is still unconfirmed; the value is preserved in webhook logs.
    stop_desk:         input.stopDesk ? 1 : 0,
  }
}

export const zimouAdapter: CarrierAdapter = {
  provider: 'zimou',
  label:    'Zimou Express',
  baseUrl:  DEFAULT_BASE,
  supportsValidate: false,
  credentialFields: [
    { key: 'token', label: 'token', required: true, placeholder: 'API token (359386|…)' },
  ],

  async createShipment(creds, input) {
    const pkg = toPackage(input)
    const res  = await call(creds, '/packages', { method: 'POST', body: JSON.stringify(pkg) })
    const text = await res.text().catch(() => '')
    let body: unknown = text
    try { body = JSON.parse(text) } catch { /* keep raw text */ }
    const tracking = res.ok ? extractTracking(body) : null
    return {
      ok:       res.ok && !!tracking,
      tracking,
      message:  res.ok ? (tracking ? undefined : 'No tracking code in Zimou response') : `HTTP ${res.status}`,
      raw:      { request: pkg, status: res.status, response: body },
    }
  },

  async ping(creds) {
    try {
      const res  = await call(creds, '/user', { method: 'GET' })
      const text = await res.text().catch(() => '')
      return res.ok
        ? { ok: true, message: 'OK' }
        : { ok: false, message: `HTTP ${res.status}${text ? ` — ${text.slice(0, 120)}` : ''}` }
    } catch (e) {
      return { ok: false, message: String(e).slice(0, 160) }
    }
  },
}
