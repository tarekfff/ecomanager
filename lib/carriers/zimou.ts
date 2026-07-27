import type { CarrierAdapter, CarrierCreds, ShipmentInput } from './types'
import { normalizeDzPhone } from './types'

// Zimou Express — https://zimou.express/api/v1 (Bearer token auth). Verified live.
// Quirks learned from the real API:
//  • It returns HTTP 201 even on failure; the real signal is `error` in the body
//    (0 = ok, 1 = failed) with a `message`.
//  • `commune` is required and must exist in Zimou's list (there is no public
//    communes endpoint). Empty/unknown communes are rejected with
//    "La commune: … n'existe pas" — we fall back to the wilaya name (its capital
//    commune, which exists) and retry once.
//  • Required fields: name, client_first_name, client_last_name, client_phone,
//    address, order_id, price, type, free_delivery.
//  • Success response carries tracking at data.tracking_code and a printable
//    waybill URL at data.bordereau.
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

function splitName(full: string): { first: string; last: string } {
  const parts = (full || '').trim().split(/\s+/)
  if (parts.length <= 1) return { first: parts[0] || '—', last: parts[0] || '—' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function asObj(body: unknown): Record<string, unknown> | null {
  return body && typeof body === 'object' ? body as Record<string, unknown> : null
}
function bodyError(body: unknown): boolean {
  const o = asObj(body)
  return o?.error === 1 || o?.error === '1'
}
function bodyMessage(body: unknown): string {
  const o = asObj(body)
  return typeof o?.message === 'string' ? o.message : ''
}

// tracking at data.tracking_code (or a few tolerant fallbacks).
function extractTracking(body: unknown): string | null {
  const keys = ['tracking', 'tracking_code', 'trackingCode', 'code', 'reference']
  const scan = (o: unknown): string | null => {
    const rec = asObj(o)
    if (!rec) return null
    for (const k of keys) {
      const v = rec[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
      if (typeof v === 'number') return String(v)
    }
    return null
  }
  return scan(body) ?? scan(asObj(body)?.data) ?? null
}

function toPackage(input: ShipmentInput, commune: string): Record<string, unknown> {
  const { first, last } = splitName(input.clientName)
  return {
    name:              (input.products || input.reference || 'Colis').slice(0, 255),
    client_first_name: first,
    client_last_name:  last,
    client_phone:      normalizeDzPhone(input.phone),
    client_phone2:     input.phone2 ? normalizeDzPhone(input.phone2) : '',
    address:           input.address?.trim() || commune || input.wilayaName || '—',
    commune,
    wilaya:            input.wilayaName || String(input.wilayaId),
    order_id:          input.reference,
    weight:            input.weightG ?? 500,
    price:             input.amount ?? 0,
    type:              1,      // required — package category (e-commerce)
    free_delivery:     false,  // required — COD orders are not free delivery
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
    const post = async (commune: string) => {
      const pkg  = toPackage(input, commune)
      const res  = await call(creds, '/packages', { method: 'POST', body: JSON.stringify(pkg) })
      const text = await res.text().catch(() => '')
      let body: unknown = text
      try { body = JSON.parse(text) } catch { /* keep raw text */ }
      return { res, body, pkg }
    }

    const wilaya = input.wilayaName || ''
    let { res, body, pkg } = await post(input.commune?.trim() || wilaya)

    // If Zimou rejects the commune, retry once with the wilaya name.
    if (bodyError(body) && /commune/i.test(bodyMessage(body)) && (input.commune?.trim() || '') !== wilaya && wilaya) {
      ;({ res, body, pkg } = await post(wilaya))
    }

    const failed   = bodyError(body)
    const tracking = res.ok && !failed ? extractTracking(body) : null
    const data     = asObj(body)?.data
    const bordereau = typeof asObj(data)?.bordereau === 'string' ? asObj(data)!.bordereau as string : null
    return {
      ok:       res.ok && !failed && !!tracking,
      tracking,
      labelUrl: bordereau,
      message:  failed ? (bodyMessage(body) || 'Zimou error')
                       : (tracking ? undefined : `HTTP ${res.status} — no tracking`),
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
