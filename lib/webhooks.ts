import { createHmac } from 'crypto'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db'
import {
  noestCreateOrder,
  noestValidateOrder,
  noestRequestReturn,
  normalizePhone,
  NoestCreatePayload,
} from '@/lib/noest'

// ─────────────────────────────────────────────────────────────────────────────
// Webhook dispatcher
//
// Fires saved webhooks on order lifecycle events and records every attempt in
// `webhook_logs`. Two kinds of webhook are handled:
//   • Generic   → signed HTTP POST of the order payload to the configured URL.
//   • NOEST     → routed through lib/noest.ts (create / validate / return) so the
//                 saved webhook IS the integration with the livraison société.
//                 Only acts on orders whose assigned société has platform='noest'.
//
// Dispatch is best-effort: failures are logged but never thrown, so an order
// transition is never blocked by a webhook problem.
// ─────────────────────────────────────────────────────────────────────────────

// Map an order transition action → the webhook event it emits.
const ACTION_EVENT: Record<string, string> = {
  created:                 'OrderCreated',
  confirm:                 'OrderConfirmed',
  dispatch:                'OrderDispatched',
  ship:                    'OrderShipped',
  deliver:                 'OrderDelivered',
  cancel:                  'OrderCanceled',
  request_return:          'OrderReturned',
  validate_return:         'OrderReturned',
  set_confirmation_status: 'OrderConfirmationStatusChanged',
  set_delivery_status:     'OrderShippingStatusChanged',
  assign_carrier:          'OrderCarrierChanged',
  assign_confirmer:        'OrderConfirmerChanged',
  restore:                 'OrderRestored',
}

export function eventForAction(action: string): string | null {
  return ACTION_EVENT[action] ?? null
}

function isNoestUrl(url: string): boolean {
  return /noest-dz\.com/i.test(url)
}

interface WebhookRow {
  id:           string
  name:         string
  event:        string
  url:          string
  secret:       string | null
  boutique_ids: string[] | null
  is_active:    boolean
}

interface LogInput {
  webhookId:  string
  orderId:    string | null
  event:      string
  httpStatus: number | null
  payload:    unknown
  response:   string
  durationMs: number
}

async function writeLog(l: LogInput) {
  await db.from('webhook_logs').insert({
    id:              uuid(),
    webhook_id:      l.webhookId,
    order_id:        l.orderId,
    event:           l.event,
    http_status:     l.httpStatus,
    request_payload: l.payload,
    response_body:   l.response.slice(0, 4000),
    attempt:         1,
    duration_ms:     l.durationMs,
  })
}

// ── Build the JSON body sent to generic webhooks ────────────────────────────────

async function buildOrderPayload(orderId: string, event: string) {
  const { data } = await db
    .from('orders')
    .select(`
      id, reference, tracking_status, confirmation_status, delivery_status,
      subtotal, delivery_fee, carrier_fee, discount, total,
      delivery_method, wilaya_id, commune_id, address, phone, phone2, remark,
      created_at, confirmed_at, dispatched_at, shipped_at, delivered_at,
      clients!client_id(full_name, phone),
      communes!commune_id(name),
      carriers!assigned_carrier_id(name, platform),
      order_items(product_name, sku, quantity, unit_price, line_total)
    `)
    .eq('id', orderId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = data as any
  if (!o) return null

  return {
    event,
    sent_at: new Date().toISOString(),
    order: {
      id:                  o.id,
      reference:           o.reference,
      tracking_status:     o.tracking_status,
      confirmation_status: o.confirmation_status,
      delivery_status:     o.delivery_status,
      subtotal:            o.subtotal,
      delivery_fee:        o.delivery_fee,
      carrier_fee:         o.carrier_fee,
      discount:            o.discount,
      total:               o.total,
      delivery_method:     o.delivery_method,
      wilaya_id:           o.wilaya_id,
      commune:             o.communes?.name ?? null,
      address:             o.address,
      phone:               o.phone,
      phone2:              o.phone2,
      remark:              o.remark,
      client:              o.clients?.full_name ?? null,
      client_phone:        o.clients?.phone ?? o.phone,
      carrier:             o.carriers?.name ?? null,
      created_at:          o.created_at,
      items: (o.order_items ?? []).map((i: Record<string, unknown>) => ({
        product_name: i.product_name,
        sku:          i.sku,
        quantity:     i.quantity,
        unit_price:   i.unit_price,
        line_total:   i.line_total,
      })),
    },
  }
}

// ── Generic webhook: signed HTTP POST ───────────────────────────────────────────

async function dispatchGeneric(wh: WebhookRow, orderId: string, event: string) {
  const payload = await buildOrderPayload(orderId, event)
  if (!payload) return

  const bodyStr = JSON.stringify(payload)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (wh.secret) {
    headers['X-Webhook-Signature'] =
      'sha256=' + createHmac('sha256', wh.secret).update(bodyStr).digest('hex')
  }

  const started = Date.now()
  try {
    const res  = await fetch(wh.url, { method: 'POST', headers, body: bodyStr })
    const text = await res.text().catch(() => '')
    await writeLog({
      webhookId: wh.id, orderId, event,
      httpStatus: res.status, payload, response: text, durationMs: Date.now() - started,
    })
  } catch (e) {
    await writeLog({
      webhookId: wh.id, orderId, event,
      httpStatus: null, payload, response: String(e), durationMs: Date.now() - started,
    })
  }
}

// ── NOEST webhook: route through the NOEST API ──────────────────────────────────

async function getNoestTracking(orderId: string): Promise<string | null> {
  const { data } = await db
    .from('order_logs')
    .select('new_values')
    .eq('order_id', orderId)
    .eq('action', 'noest_push')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.new_values as { noest_tracking?: string } | null)?.noest_tracking ?? null
}

async function noestCreateFromOrder(orderId: string): Promise<{ payload: NoestCreatePayload; result: unknown; tracking: string | null }> {
  const { data } = await db
    .from('orders')
    .select(`
      reference, phone, phone2, address, wilaya_id, total, remark, delivery_method,
      clients!client_id(full_name),
      communes!commune_id(name),
      order_items(product_name, quantity)
    `)
    .eq('id', orderId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fo = data as any
  const produit = (fo.order_items as { product_name: string; quantity: number }[])
    .map(i => (i.quantity > 1 ? `${i.product_name} x${i.quantity}` : i.product_name))
    .join(', ') || 'Produit'

  const payload: NoestCreatePayload = {
    reference: fo.reference,
    client:    fo.clients?.full_name ?? fo.phone,
    phone:     normalizePhone(fo.phone),
    phone_2:   fo.phone2 ? normalizePhone(fo.phone2) : undefined,
    adresse:   fo.address?.trim() || fo.communes?.name || 'Adresse non renseignée',
    wilaya_id: fo.wilaya_id ?? 16,
    commune:   fo.communes?.name ?? '',
    montant:   fo.total ?? 0,
    remarque:  fo.remark ?? undefined,
    produit,
    type_id:   1,
    stop_desk: fo.delivery_method === 'stopdesk' ? 1 : 0,
  }

  const result = await noestCreateOrder(payload)
  const tracking = result.success && result.tracking ? result.tracking : null
  return { payload, result, tracking }
}

async function dispatchNoest(
  wh: WebhookRow,
  orderId: string,
  event: string,
  action: string,
  userId: string | null,
) {
  // Only act on orders assigned to a société whose platform is NOEST.
  const { data: order } = await db
    .from('orders')
    .select('assigned_carrier_id, carriers!assigned_carrier_id(platform)')
    .eq('id', orderId)
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const platform = (order as any)?.carriers?.platform as string | null | undefined
  if (!platform || platform.toLowerCase() !== 'noest') return

  const started = Date.now()

  try {
    // On ship/dispatch make sure the order exists on NOEST, then validate on ship.
    if (action === 'dispatch' || action === 'ship') {
      let tracking = await getNoestTracking(orderId)

      if (!tracking) {
        const { payload, result, tracking: newTracking } = await noestCreateFromOrder(orderId)
        tracking = newTracking
        if (tracking) {
          await db.from('order_logs').insert({
            id: uuid(), order_id: orderId, user_id: userId,
            action: 'noest_push', new_values: { noest_tracking: tracking },
          })
        }
        await writeLog({
          webhookId: wh.id, orderId, event,
          httpStatus: tracking ? 200 : 422,
          payload: { action: 'create', ...payload },
          response: JSON.stringify(result), durationMs: Date.now() - started,
        })
      }

      if (action === 'ship' && tracking) {
        const vStarted = Date.now()
        const vResult  = await noestValidateOrder(tracking)
        if (vResult.success) {
          await db.from('order_logs').insert({
            id: uuid(), order_id: orderId, user_id: userId,
            action: 'noest_validate', new_values: { noest_tracking: tracking },
          })
        }
        await writeLog({
          webhookId: wh.id, orderId, event,
          httpStatus: vResult.success ? 200 : 422,
          payload: { action: 'validate', tracking },
          response: JSON.stringify(vResult), durationMs: Date.now() - vStarted,
        })
      }
      return
    }

    if (action === 'request_return') {
      const tracking = await getNoestTracking(orderId)
      if (!tracking) return
      const result = await noestRequestReturn(tracking)
      if (result.success) {
        await db.from('order_logs').insert({
          id: uuid(), order_id: orderId, user_id: userId,
          action: 'noest_return_requested', new_values: { noest_tracking: tracking },
        })
      }
      await writeLog({
        webhookId: wh.id, orderId, event,
        httpStatus: result.success ? 200 : 422,
        payload: { action: 'return', tracking },
        response: JSON.stringify(result), durationMs: Date.now() - started,
      })
    }
  } catch (e) {
    await writeLog({
      webhookId: wh.id, orderId, event,
      httpStatus: null, payload: { action, error: true },
      response: String(e), durationMs: Date.now() - started,
    })
  }
}

// ── Public entry point ──────────────────────────────────────────────────────────

interface FireOpts {
  tenantId:   string
  boutiqueId: string
  orderId:    string
  action:     string
  userId?:    string | null
}

/** Fire all webhooks subscribed to the event emitted by `action`, for one order.
 *  Best-effort: never throws. Call after the order row has been updated. */
export async function fireOrderWebhooks(opts: FireOpts): Promise<void> {
  const event = eventForAction(opts.action)
  if (!event) return

  try {
    const { data } = await db
      .from('webhooks')
      .select('id, name, event, url, secret, boutique_ids, is_active')
      .eq('tenant_id', opts.tenantId)
      .eq('event', event)
      .eq('is_active', true)

    const hooks = ((data ?? []) as WebhookRow[]).filter(
      wh => !wh.boutique_ids?.length || wh.boutique_ids.includes(opts.boutiqueId),
    )
    if (hooks.length === 0) return

    await Promise.all(hooks.map(wh =>
      isNoestUrl(wh.url)
        ? dispatchNoest(wh, opts.orderId, event, opts.action, opts.userId ?? null)
        : dispatchGeneric(wh, opts.orderId, event),
    ))
  } catch {
    // Dispatching must never break the order transition.
  }
}
