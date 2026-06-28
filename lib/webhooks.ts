import { createHmac } from 'crypto'
import { v4 as uuid } from 'uuid'
import { db } from '@/lib/db'
import {
  noestCreateOrder,
  noestValidateOrder,
  noestRequestReturn,
  noestDeleteOrder,
  noestUpdateOrder,
  noestUpdateOrderBeforeExpedition,
  normalizePhone,
  NoestCreatePayload,
  NoestUpdatePayload,
} from '@/lib/noest'

// ─────────────────────────────────────────────────────────────────────────────
// Webhook dispatcher — DYNAMIC per livraison société
//
// A webhook = a livraison société the user added. An order is dispatched to ONE
// société (the chosen webhook), which is then remembered for that order. Every
// later lifecycle event drives THAT société's integration:
//   • NOEST webhook (url = noest-dz.com) → routed through the NOEST API
//       (create / validate / update / delete / return) per the NOEST PDF.
//   • Any other webhook → signed HTTP POST of { event, action, order } to its URL,
//       so the société's own endpoint receives the whole flow and can react.
//
// Separately, plain notification webhooks (subscribed to a single event) still
// fire for every order matching that event.
//
// Best-effort: failures are logged to webhook_logs, never thrown — an order
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
  updated:                 'OrderAddressChanged',
  set_confirmation_status: 'OrderConfirmationStatusChanged',
  set_delivery_status:     'OrderShippingStatusChanged',
  assign_carrier:          'OrderCarrierChanged',
  assign_confirmer:        'OrderConfirmerChanged',
  restore:                 'OrderRestored',
}

export function eventForAction(action: string): string | null {
  return ACTION_EVENT[action] ?? null
}

// Lifecycle actions that drive the order's delivery-société integration.
const DELIVERY_ACTIONS = new Set([
  'dispatch', 'ship', 'deliver', 'cancel', 'request_return', 'validate_return',
  'updated', 'set_delivery_status',
])

/** Whether an action should trigger any webhook work (notification or delivery). */
export function shouldFireWebhooks(action: string): boolean {
  return !!eventForAction(action) || DELIVERY_ACTIONS.has(action)
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

async function dispatchGeneric(wh: WebhookRow, orderId: string, event: string, action?: string) {
  const payload = await buildOrderPayload(orderId, event)
  if (!payload) return
  if (action) (payload as Record<string, unknown>).action = action

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

// Build the NOEST update payload (§5 / §5.1) from the current order row.
async function noestUpdateFromOrder(orderId: string, tracking: string): Promise<NoestUpdatePayload> {
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
  const produit = (fo.order_items as { product_name: string; quantity: number }[] ?? [])
    .map(i => (i.quantity > 1 ? `${i.product_name} x${i.quantity}` : i.product_name))
    .join(', ') || undefined

  return {
    tracking,
    client:    fo.clients?.full_name ?? undefined,
    reference: fo.reference,
    tel:       fo.phone ? normalizePhone(fo.phone) : undefined,
    tel2:      fo.phone2 ? normalizePhone(fo.phone2) : undefined,
    adresse:   fo.address?.trim() || fo.communes?.name || undefined,
    commune:   fo.communes?.name ?? undefined,
    montant:   fo.total ?? undefined,
    remarque:  fo.remark ?? undefined,
    product:   produit,
    stop_desk: fo.delivery_method === 'stopdesk' ? 1 : 0,
  }
}

async function dispatchNoest(
  wh: WebhookRow,
  orderId: string,
  event: string,
  action: string,
  userId: string | null,
) {
  const { data: order } = await db
    .from('orders')
    .select('tracking_status')
    .eq('id', orderId)
    .single()
  const status = (order as { tracking_status: string } | null)?.tracking_status ?? ''

  const started = Date.now()

  try {
    switch (action) {
      // ── Create on dispatch; create + validate on ship ────────────────────────
      case 'dispatch':
      case 'ship': {
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
            payload: { noest_action: 'create', ...payload },
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
            payload: { noest_action: 'validate', tracking },
            response: JSON.stringify(vResult), durationMs: Date.now() - vStarted,
          })
        }
        return
      }

      // ── Edit → push changes to NOEST (§5.1 before expedition, §5 after) ───────
      case 'updated': {
        const tracking = await getNoestTracking(orderId)
        if (!tracking) return   // not on NOEST yet — nothing to update
        const payload = await noestUpdateFromOrder(orderId, tracking)
        const beforeExpedition = status === 'en_preparation' || status === 'en_dispatch'
        const result = beforeExpedition
          ? await noestUpdateOrderBeforeExpedition(payload)
          : await noestUpdateOrder(payload)
        await writeLog({
          webhookId: wh.id, orderId, event,
          httpStatus: result.success ? 200 : 422,
          payload: { noest_action: beforeExpedition ? 'update_before_expedition' : 'update', ...payload },
          response: JSON.stringify(result), durationMs: Date.now() - started,
        })
        return
      }

      // ── Cancel → delete on NOEST (only succeeds while unvalidated) ────────────
      case 'cancel': {
        const tracking = await getNoestTracking(orderId)
        if (!tracking) return
        const result = await noestDeleteOrder(tracking)
        await writeLog({
          webhookId: wh.id, orderId, event,
          httpStatus: result.success ? 200 : 422,
          payload: { noest_action: 'delete', tracking },
          response: JSON.stringify(result), durationMs: Date.now() - started,
        })
        return
      }

      // ── Return request ───────────────────────────────────────────────────────
      case 'request_return': {
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
          payload: { noest_action: 'return', tracking },
          response: JSON.stringify(result), durationMs: Date.now() - started,
        })
        return
      }

      // NOEST drives delivery itself — deliver / set_delivery_status / validate_return
      // need no outbound call.
      default:
        return
    }
  } catch (e) {
    await writeLog({
      webhookId: wh.id, orderId, event,
      httpStatus: null, payload: { noest_action: action, error: true },
      response: String(e), durationMs: Date.now() - started,
    })
  }
}

// ── Resolve a saved webhook → a carrier row (for assigned_carrier_id) ────────────
// The dispatch dropdown lists the saved livraison-société webhooks. An order still
// needs a carrier (FK + receipts + stats), so we map the chosen webhook to a
// carrier for the boutique, creating one on first use. NOEST webhooks map to a
// carrier with platform='noest' so the existing NOEST gating keeps working.

const WEBHOOK_COLS = 'id, name, event, url, secret, boutique_ids, is_active'

export async function resolveCarrierForWebhook(
  tenantId: string,
  boutiqueId: string,
  webhookId: string,
): Promise<{ carrierId: string; webhook: WebhookRow } | null> {
  const { data } = await db
    .from('webhooks')
    .select(WEBHOOK_COLS)
    .eq('tenant_id', tenantId)
    .eq('id', webhookId)
    .eq('is_active', true)
    .maybeSingle()

  const webhook = data as WebhookRow | null
  if (!webhook) return null

  const platform = isNoestUrl(webhook.url) ? 'noest' : 'api'

  // Find an existing carrier for this boutique with the matching platform.
  const { data: existing } = await db
    .from('carriers')
    .select('id, carrier_boutiques!inner(boutique_id)')
    .eq('tenant_id', tenantId)
    .eq('platform', platform)
    .eq('carrier_boutiques.boutique_id', boutiqueId)
    .limit(1)
    .maybeSingle()

  if (existing) return { carrierId: (existing as { id: string }).id, webhook }

  // None yet — create a carrier for this société and link it to the boutique.
  const carrierId = uuid()
  await db.from('carriers').insert({
    id: carrierId, tenant_id: tenantId, name: webhook.name,
    platform, is_active: true,
  })
  await db.from('carrier_boutiques').insert({ carrier_id: carrierId, boutique_id: boutiqueId })

  return { carrierId, webhook }
}

// ── Per-order delivery société tracking ──────────────────────────────────────────

function matchesBoutique(wh: WebhookRow, boutiqueId: string): boolean {
  return !wh.boutique_ids?.length || wh.boutique_ids.includes(boutiqueId)
}

/** Remember which société (webhook) an order was dispatched to. */
async function recordOrderWebhook(orderId: string, webhookId: string, userId: string | null) {
  await db.from('order_logs').insert({
    id: uuid(), order_id: orderId, user_id: userId,
    action: 'delivery_webhook', new_values: { webhook_id: webhookId },
  })
}

/** Load the active webhook an order was dispatched to (its livraison société). */
async function getOrderDeliveryWebhook(tenantId: string, orderId: string): Promise<WebhookRow | null> {
  const { data: log } = await db
    .from('order_logs')
    .select('new_values')
    .eq('order_id', orderId)
    .eq('action', 'delivery_webhook')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const webhookId = (log?.new_values as { webhook_id?: string } | null)?.webhook_id
  if (!webhookId) return null

  const { data } = await db
    .from('webhooks')
    .select(WEBHOOK_COLS)
    .eq('tenant_id', tenantId)
    .eq('id', webhookId)
    .eq('is_active', true)
    .maybeSingle()
  return data as WebhookRow | null
}

async function fireDeliveryWebhook(
  wh: WebhookRow, orderId: string, event: string, action: string, userId: string | null,
) {
  if (isNoestUrl(wh.url)) await dispatchNoest(wh, orderId, event, action, userId)
  else await dispatchGeneric(wh, orderId, event, action)
}

// ── Public entry point ──────────────────────────────────────────────────────────

interface FireOpts {
  tenantId:   string
  boutiqueId: string
  orderId:    string
  action:     string
  userId?:    string | null
  webhookId?: string | null   // société chosen at dispatch
}

/** Fire webhooks for an order transition. Best-effort: never throws.
 *  Drives the order's delivery société (dynamic — whichever webhook it was
 *  dispatched to) across the whole lifecycle, plus any notification webhooks
 *  subscribed to the event. */
export async function fireOrderWebhooks(opts: FireOpts): Promise<void> {
  const event = eventForAction(opts.action)

  try {
    const tasks: Promise<void>[] = []
    let deliveryWh: WebhookRow | null = null

    // 1. Determine this order's delivery société (chosen now at dispatch, or remembered)
    if (opts.webhookId) {
      const { data } = await db
        .from('webhooks')
        .select(WEBHOOK_COLS)
        .eq('tenant_id', opts.tenantId)
        .eq('id', opts.webhookId)
        .eq('is_active', true)
        .maybeSingle()
      deliveryWh = data as WebhookRow | null
      if (deliveryWh && opts.action === 'dispatch') {
        await recordOrderWebhook(opts.orderId, deliveryWh.id, opts.userId ?? null)
      }
    } else if (DELIVERY_ACTIONS.has(opts.action)) {
      deliveryWh = await getOrderDeliveryWebhook(opts.tenantId, opts.orderId)
    }

    // 2. Drive the delivery société integration for this order
    if (deliveryWh && matchesBoutique(deliveryWh, opts.boutiqueId)) {
      tasks.push(fireDeliveryWebhook(
        deliveryWh, opts.orderId, event ?? opts.action, opts.action, opts.userId ?? null,
      ))
    }

    // 3. Notification webhooks subscribed to this event (excluding the delivery
    //    société itself and NOEST URLs, which are delivery-only)
    if (event) {
      const { data } = await db
        .from('webhooks')
        .select(WEBHOOK_COLS)
        .eq('tenant_id', opts.tenantId)
        .eq('event', event)
        .eq('is_active', true)

      for (const wh of (data ?? []) as WebhookRow[]) {
        if (wh.id === deliveryWh?.id) continue
        if (isNoestUrl(wh.url)) continue
        if (matchesBoutique(wh, opts.boutiqueId)) {
          tasks.push(dispatchGeneric(wh, opts.orderId, event, opts.action))
        }
      }
    }

    if (tasks.length) await Promise.all(tasks)
  } catch {
    // Dispatching must never break the order transition.
  }
}
