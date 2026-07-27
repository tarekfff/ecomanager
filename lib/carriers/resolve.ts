import { db } from '@/lib/db'
import { parseCarrierConfig } from './index'
import type { NoestCreds } from '@/lib/noest'

const WCOLS = 'id, url, secret'

function toNoest(creds: Record<string, string>): NoestCreds {
  return { token: creds.token, guid: creds.guid, baseUrl: creds.baseUrl }
}

/**
 * Resolve a tenant's NOEST credentials for the aux routes (label / reference /
 * manual panel). Prefers the connection an order was dispatched to, then any
 * active NOEST connection for the tenant, and finally the shared env-var account
 * (empty creds → lib/noest falls back to NOEST_API_TOKEN / NOEST_USER_GUID).
 */
export async function resolveNoestCreds(tenantId: string, orderId?: string): Promise<NoestCreds> {
  // 1. The société the order was dispatched to.
  if (orderId) {
    const { data: log } = await db
      .from('order_logs')
      .select('new_values')
      .eq('order_id', orderId)
      .eq('action', 'delivery_webhook')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const whId = (log?.new_values as { webhook_id?: string } | null)?.webhook_id
    if (whId) {
      const { data } = await db
        .from('webhooks')
        .select(WCOLS)
        .eq('tenant_id', tenantId)
        .eq('id', whId)
        .maybeSingle()
      const cfg = data ? parseCarrierConfig(data as { url: string; secret: string | null }) : null
      if (cfg?.provider === 'noest') return toNoest(cfg.creds)
    }
  }

  // 2. Any active NOEST connection for the tenant.
  const { data: all } = await db
    .from('webhooks')
    .select(WCOLS)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
  for (const wh of (all ?? []) as { url: string; secret: string | null }[]) {
    const cfg = parseCarrierConfig(wh)
    if (cfg?.provider === 'noest') return toNoest(cfg.creds)
  }

  // 3. Env-var fallback.
  return {}
}
