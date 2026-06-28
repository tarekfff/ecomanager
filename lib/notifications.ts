import { db } from './db'
import { v4 as uuid } from 'uuid'

// ── In-app notifications helper ──────────────────────────────────────────────────
// Best-effort inserts into `notifications`. A notification failure must never
// break the action that triggered it (order transition, stock movement, …).

type Meta = Record<string, unknown>

/** Insert one notification row per user. */
export async function notifyUsers(
  userIds: string[],
  type: string,
  title: string,
  body: string,
  meta: Meta = {},
): Promise<void> {
  const ids = [...new Set(userIds)].filter(Boolean)
  if (!ids.length) return
  try {
    await db.from('notifications').insert(
      ids.map(uid => ({ id: uuid(), user_id: uid, type, title, body, meta })),
    )
  } catch {
    // notifications are non-critical — swallow errors
  }
}

/** Notify every active user in a tenant. */
export async function notifyTenant(
  tenantId: string,
  type: string,
  title: string,
  body: string,
  meta: Meta = {},
): Promise<void> {
  try {
    const { data } = await db
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
    await notifyUsers((data ?? []).map((u: { id: string }) => u.id), type, title, body, meta)
  } catch {
    // ignore
  }
}

/** After a stock deduction, notify the tenant if the product is now at or under
 *  its alert threshold. v_stock_alerts already filters to alert-enabled products
 *  whose current quantity is ≤ stock_alert_min. */
export async function notifyStockAlert(tenantId: string, productId: string): Promise<void> {
  try {
    const { data } = await db
      .from('v_stock_alerts')
      .select('product_name, sku, current_qty, stock_alert_min')
      .eq('tenant_id', tenantId)
      .eq('product_id', productId)
      .maybeSingle()
    if (!data) return
    const a = data as {
      product_name: string; sku: string | null; current_qty: number; stock_alert_min: number
    }
    await notifyTenant(
      tenantId,
      'stock_alert',
      `Stock faible : ${a.product_name}`,
      `Il ne reste que ${a.current_qty} unité(s) en stock (seuil d'alerte : ${a.stock_alert_min}).`,
      { product_id: productId, sku: a.sku },
    )
  } catch {
    // ignore
  }
}

/** Notify the tenant that an order reached the "livrée" stage. */
export async function notifyOrderDelivered(tenantId: string, reference: string): Promise<void> {
  await notifyTenant(
    tenantId,
    'order_delivered',
    `Commande livrée`,
    `La commande #${reference} a été livrée.`,
    { reference },
  )
}

/** Notify the tenant that an order was returned ("retournée"). */
export async function notifyOrderReturned(tenantId: string, reference: string): Promise<void> {
  await notifyTenant(
    tenantId,
    'order_returned',
    `Commande retournée`,
    `La commande #${reference} a été retournée.`,
    { reference },
  )
}
