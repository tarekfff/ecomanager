import type { CarrierAdapter, CarrierCreds, CredentialField } from './types'
import { noestAdapter } from './noest'
import { zimouAdapter } from './zimou'

// Register every carrier adapter here. Adding a new carrier = import + one entry.
export const ADAPTERS: Record<string, CarrierAdapter> = {
  noest: noestAdapter,
  zimou: zimouAdapter,
}

export function getAdapter(provider: string | null | undefined): CarrierAdapter | null {
  return provider ? ADAPTERS[provider] ?? null : null
}

/** Provider metadata for the Add/Edit webhook form (dropdown + credential inputs). */
export interface ProviderMeta {
  provider:         string
  label:            string
  baseUrl:          string
  credentialFields: CredentialField[]
  supportsValidate: boolean
}

export const PROVIDERS: ProviderMeta[] = Object.values(ADAPTERS).map(a => ({
  provider:         a.provider,
  label:            a.label,
  baseUrl:          a.baseUrl,
  credentialFields: a.credentialFields,
  supportsValidate: a.supportsValidate,
}))

/** Detect a provider from a known host (legacy webhooks stored only a URL). */
export function providerForUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (/noest-dz\.com/i.test(url)) return 'noest'
  if (/zimou\.express/i.test(url)) return 'zimou'
  return null
}

/** Serialize provider + per-tenant credentials for the webhook `secret` column. */
export function buildCarrierSecret(provider: string, creds: CarrierCreds): string {
  return JSON.stringify({ p: provider, ...creds })
}

/**
 * Resolve a webhook row → { provider, creds }, or null if it's a plain
 * notification webhook. New rows store `{"p":"zimou","token":"…"}` in `secret`;
 * legacy NOEST rows are detected by URL and fall back to the env-var account
 * (empty creds → lib/noest uses NOEST_API_TOKEN / NOEST_USER_GUID).
 */
export function parseCarrierConfig(
  wh: { url: string; secret: string | null },
): { provider: string; creds: CarrierCreds } | null {
  if (wh.secret) {
    try {
      const parsed = JSON.parse(wh.secret) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && typeof parsed.p === 'string' && ADAPTERS[parsed.p]) {
        const { p, ...rest } = parsed
        const creds: CarrierCreds = {}
        for (const [k, v] of Object.entries(rest)) if (typeof v === 'string') creds[k] = v
        return { provider: p as string, creds }
      }
    } catch {
      // secret is a plain HMAC value, not carrier JSON — fall through to URL detection
    }
  }
  const prov = providerForUrl(wh.url)
  if (prov === 'noest') return { provider: 'noest', creds: {} } // env-var fallback
  return null
}

/** True when a webhook drives a carrier integration (vs a plain notification). */
export function isCarrierWebhook(wh: { url: string; secret: string | null }): boolean {
  return parseCarrierConfig(wh) !== null
}

/**
 * Validate a provider + submitted credentials and produce the webhook row fields
 * (url + secret + event). Shared by the create/update API routes.
 * `event` is a delivery-only sentinel — carrier webhooks are excluded from the
 * notification dispatch, so its value is never matched there.
 */
export function buildCarrierWebhookFields(
  provider: string,
  credentials: Record<string, unknown> | undefined,
  urlOverride?: string,
): { ok: true; url: string; secret: string; event: string } | { ok: false; error: string } {
  const adapter = getAdapter(provider)
  if (!adapter) return { ok: false, error: 'Transporteur inconnu' }

  const creds: CarrierCreds = {}
  for (const f of adapter.credentialFields) {
    const raw = credentials?.[f.key]
    const val = typeof raw === 'string' ? raw.trim() : ''
    if (f.required && !val) return { ok: false, error: `Identifiant requis: ${f.key}` }
    if (val) creds[f.key] = val
  }

  const secret = buildCarrierSecret(provider, creds)
  if (secret.length > 255) {
    return { ok: false, error: 'Identifiants trop longs (limite 255 caractères)' }
  }
  const url = (urlOverride && urlOverride.trim()) || adapter.baseUrl
  return { ok: true, url, secret, event: 'OrderShipped' }
}

export type { CarrierAdapter, CarrierCreds, ShipmentInput } from './types'
