// ── Carrier adapter framework ────────────────────────────────────────────────
// Each delivery société (NOEST, Zimou, …) is a self-contained adapter implementing
// this interface. A "delivery webhook" row stores which provider + the tenant's own
// credentials; the dispatcher picks the adapter and drives the shipment lifecycle.
// Adding a new carrier = one new adapter file + registering it in ./index.ts.

/** Per-tenant credentials, provider-specific (e.g. { token, guid } for NOEST). */
export type CarrierCreds = Record<string, string>

/** A credential input the UI renders for a provider (drives the Add-webhook form). */
export interface CredentialField {
  key:          string
  label:        string   // i18n key suffix, resolved in the UI
  required:     boolean
  placeholder?: string
}

/** Normalized order → shipment input. Each adapter maps this to its own API shape. */
export interface ShipmentInput {
  reference:   string
  clientName:  string
  phone:       string
  phone2?:     string
  address:     string
  wilayaId:    number
  wilayaName:  string
  commune:     string
  amount:      number    // COD total to collect
  products:    string    // human summary, e.g. "Abaya x2, Foulard"
  weightG?:    number
  stopDesk:    boolean   // true = stop-desk, false = home delivery
  remark?:     string
}

/** Uniform result from any carrier call. `raw` is logged to webhook_logs. */
export interface CarrierResult {
  ok:        boolean
  tracking?: string | null
  message?:  string
  raw:       unknown
}

export interface CarrierAdapter {
  provider:         string          // stable id: 'noest' | 'zimou'
  label:            string          // display name
  baseUrl:          string          // default API base
  credentialFields: CredentialField[]
  /** NOEST needs a separate "validate" step after create; Zimou does not. */
  supportsValidate: boolean

  createShipment(creds: CarrierCreds, input: ShipmentInput): Promise<CarrierResult>
  validateShipment?(creds: CarrierCreds, tracking: string): Promise<CarrierResult>
  updateShipment?(creds: CarrierCreds, tracking: string, input: ShipmentInput, beforeExpedition: boolean): Promise<CarrierResult>
  cancelShipment?(creds: CarrierCreds, tracking: string): Promise<CarrierResult>
  requestReturn?(creds: CarrierCreds, tracking: string): Promise<CarrierResult>
  /** Read-only connectivity + credential check (non-destructive). */
  ping(creds: CarrierCreds): Promise<{ ok: boolean; message?: string }>
}

// Shared helper: normalize an Algerian phone to 0XXXXXXXXX (strip +213 / 213).
export function normalizeDzPhone(phone: string): string {
  let p = (phone ?? '').replace(/\s+/g, '').replace(/[^0-9+]/g, '')
  if (p.startsWith('+213')) p = '0' + p.slice(4)
  else if (p.startsWith('213')) p = '0' + p.slice(3)
  return p
}
