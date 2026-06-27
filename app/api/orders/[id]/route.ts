import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'
import {
  getOrderItems,
  deductStockForOrder,
  restoreStockForOrder,
  STOCK_DEDUCTED_STATUSES,
} from '@/lib/stock-order'
import {
  noestCreateOrder,
  noestValidateOrder,
  noestRequestReturn,
  NoestCreatePayload,
} from '@/lib/noest'

type Ctx = { params: Promise<{ id: string }> }

// ── GET — full order detail ────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Ctx) {
  const user   = requireAuth(req)
  const { id } = await params

  const { data, error } = await db
    .from('orders')
    .select(`
      id, reference, tracking_status, confirmation_status, delivery_status,
      total, subtotal, delivery_fee, carrier_fee, discount,
      delivery_method, return_risk_score,
      address, phone, phone2, remark, referrer, source_type, boutique_id,
      wilaya_id, commune_id, sync_enabled, deleted_at,
      created_at, confirmed_at, dispatched_at, shipped_at, delivered_at, cancelled_at,
      clients!client_id(id, full_name, phone, phone2, email, address),
      wilayas!wilaya_id(id, name),
      communes!commune_id(id, name),
      users!assigned_confirmer_id(name),
      carriers!assigned_carrier_id(name),
      order_items(id, product_id, variant_id, product_name, sku, quantity, unit_price, unit_cost, line_total)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  // Verify this order's boutique belongs to the requesting tenant
  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', (data as { boutique_id: string }).boutique_id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!boutique) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = data as any
  return NextResponse.json({
    id:                  o.id,
    reference:           o.reference,
    tracking_status:     o.tracking_status,
    confirmation_status: o.confirmation_status,
    delivery_status:     o.delivery_status,
    total:               o.total,
    subtotal:            o.subtotal,
    delivery_fee:        o.delivery_fee,
    carrier_fee:         o.carrier_fee,
    discount:            o.discount,
    delivery_method:     o.delivery_method,
    return_risk_score:   o.return_risk_score,
    address:             o.address,
    phone:               o.phone,
    phone2:              o.phone2,
    remark:              o.remark,
    referrer:            o.referrer,
    source_type:         o.source_type,
    boutique_id:         o.boutique_id,
    wilaya_id:           o.wilaya_id,
    commune_id:          o.commune_id,
    sync_enabled:        o.sync_enabled,
    deleted_at:          o.deleted_at,
    created_at:          o.created_at,
    confirmed_at:        o.confirmed_at,
    dispatched_at:       o.dispatched_at,
    shipped_at:          o.shipped_at,
    delivered_at:        o.delivered_at,
    cancelled_at:        o.cancelled_at,
    client:              o.clients ?? null,
    wilaya_name:         (o.wilayas  as { id: number; name: string } | null)?.name ?? null,
    commune_name:        (o.communes as { id: number; name: string } | null)?.name ?? null,
    confirmer_name:      (o.users    as { name: string } | null)?.name ?? null,
    carrier_name:        (o.carriers as { name: string } | null)?.name ?? null,
    items:               Array.isArray(o.order_items) ? o.order_items : [],
  })
}

// ── PUT — full order edit ──────────────────────────────────────────────────────

interface PutItem {
  product_id:   string
  variant_id:   string | null
  product_name: string
  sku:          string
  quantity:     number
  unit_price:   number
  unit_cost:    number
}

interface PutBody {
  full_name:       string
  phone:           string
  phone2?:         string | null
  email?:          string | null
  wilaya_id?:      number | null
  commune_id?:     number | null
  address?:        string | null
  referrer?:       string | null
  remark?:         string | null
  delivery_method: 'domicile' | 'stopdesk'
  delivery_fee:    number
  discount:        number
  items:           PutItem[]
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user   = requireAuth(req)
  const { id } = await params
  const body   = await req.json() as PutBody

  if (!body.phone?.trim())     return NextResponse.json({ error: 'Le téléphone est requis' },        { status: 400 })
  if (!body.full_name?.trim()) return NextResponse.json({ error: 'Le nom complet est requis' },      { status: 400 })
  if (!body.items?.length)     return NextResponse.json({ error: 'Au moins un article est requis' }, { status: 400 })

  // Verify order + tenant ownership
  const { data: existingOrder } = await db
    .from('orders')
    .select('boutique_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!existingOrder) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', (existingOrder as { boutique_id: string }).boutique_id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!boutique) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  // Upsert client
  const phone = body.phone.trim()
  let clientId: string

  const { data: existingClient } = await db
    .from('clients')
    .select('id')
    .eq('tenant_id', user.tenantId)
    .eq('phone', phone)
    .maybeSingle()

  if (existingClient) {
    clientId = (existingClient as { id: string }).id
    await db.from('clients').update({
      full_name:  body.full_name.trim(),
      phone2:     body.phone2?.trim()  || null,
      email:      body.email?.trim()   || null,
      address:    body.address?.trim() || null,
      wilaya_id:  body.wilaya_id  ?? null,
      commune_id: body.commune_id ?? null,
    }).eq('id', clientId)
  } else {
    clientId = uuid()
    const { error: clientErr } = await db.from('clients').insert({
      id:         clientId,
      tenant_id:  user.tenantId,
      full_name:  body.full_name.trim(),
      phone,
      phone2:     body.phone2?.trim()  || null,
      email:      body.email?.trim()   || null,
      address:    body.address?.trim() || null,
      wilaya_id:  body.wilaya_id  ?? null,
      commune_id: body.commune_id ?? null,
    })
    if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 })
  }

  const subtotal    = body.items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0)
  const deliveryFee = Number(body.delivery_fee) || 0
  const discount    = Number(body.discount)     || 0

  // Update order
  const { data: updated, error: orderErr } = await db
    .from('orders')
    .update({
      client_id:       clientId,
      phone,
      phone2:          body.phone2?.trim()   || null,
      address:         body.address?.trim()  || null,
      wilaya_id:       body.wilaya_id  ?? null,
      commune_id:      body.commune_id ?? null,
      referrer:        body.referrer?.trim() || null,
      remark:          body.remark?.trim()   || null,
      delivery_method: body.delivery_method,
      delivery_fee:    deliveryFee,
      discount,
      subtotal,
    })
    .eq('id', id)
    .select()
    .single()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })

  // Replace items
  await db.from('order_items').delete().eq('order_id', id)
  const { error: itemsErr } = await db.from('order_items').insert(
    body.items.map(it => ({
      id:           uuid(),
      order_id:     id,
      product_id:   it.product_id,
      variant_id:   it.variant_id || null,
      product_name: it.product_name,
      sku:          it.sku,
      quantity:     it.quantity,
      unit_price:   it.unit_price,
      unit_cost:    it.unit_cost || 0,
    }))
  )

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

  await db.from('order_logs').insert({
    id:         uuid(),
    order_id:   id,
    user_id:    user.sub,
    action:     'updated',
    new_values: { delivery_method: body.delivery_method, subtotal, delivery_fee: deliveryFee, discount },
  })

  return NextResponse.json(updated)
}

// ── PATCH — status transitions ─────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user   = requireAuth(req)
  const { id } = await params
  const body   = await req.json() as { action: string; value?: string }

  if (!body.action) return NextResponse.json({ error: 'Action requise' }, { status: 400 })

  // Verify ownership — include deleted orders so restore/undo_delete can work
  const { data: order } = await db
    .from('orders')
    .select('boutique_id, tracking_status, sync_enabled, reference, assigned_carrier_id')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', (order as { boutique_id: string }).boutique_id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!boutique) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const now = new Date().toISOString()
  let update: Record<string, unknown>

  switch (body.action) {
    case 'confirm':
      update = { tracking_status: 'en_preparation', confirmed_at: now }
      break

    case 'cancel':
      update = { tracking_status: 'annulee', cancelled_at: now }
      break

    case 'assign_confirmer': {
      if (!body.value) return NextResponse.json({ error: 'user_id requis' }, { status: 400 })
      const { data: targetUser } = await db
        .from('users')
        .select('id')
        .eq('id', body.value)
        .eq('tenant_id', user.tenantId)
        .single()
      if (!targetUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
      update = { assigned_confirmer_id: body.value }
      break
    }

    case 'set_confirmation_status':
      if (!body.value) return NextResponse.json({ error: 'Statut requis' }, { status: 400 })
      update = { confirmation_status: body.value }
      break

    case 'dispatch': {
      if (!body.value) return NextResponse.json({ error: 'Transporteur requis' }, { status: 400 })
      const { data: cbRow } = await db
        .from('carrier_boutiques')
        .select('carrier_id')
        .eq('carrier_id', body.value)
        .eq('boutique_id', (order as { boutique_id: string }).boutique_id)
        .single()
      if (!cbRow) return NextResponse.json({ error: 'Transporteur non associé à cette boutique' }, { status: 404 })
      update = { tracking_status: 'en_dispatch', assigned_carrier_id: body.value, dispatched_at: now }
      break
    }

    case 'assign_carrier': {
      if (!body.value) return NextResponse.json({ error: 'Transporteur requis' }, { status: 400 })
      const { data: cbRow } = await db
        .from('carrier_boutiques')
        .select('carrier_id')
        .eq('carrier_id', body.value)
        .eq('boutique_id', (order as { boutique_id: string }).boutique_id)
        .single()
      if (!cbRow) return NextResponse.json({ error: 'Transporteur non associé à cette boutique' }, { status: 404 })
      update = { assigned_carrier_id: body.value }
      break
    }

    case 'go_back_to_confirmation':
      update = { tracking_status: 'en_confirmation', confirmed_at: null }
      break

    case 'ship':
      update = { tracking_status: 'en_livraison', shipped_at: now }
      break

    case 'toggle_sync': {
      const currentSync = (order as { boutique_id: string; tracking_status: string; sync_enabled: boolean }).sync_enabled
      update = { sync_enabled: !currentSync }
      break
    }

    case 'go_back_to_preparation':
      update = { tracking_status: 'en_preparation', dispatched_at: null }
      break

    case 'deliver':
      update = { tracking_status: 'livree', delivered_at: now }
      break

    case 'request_return':
      update = { tracking_status: 'en_retour' }
      break

    case 'set_delivery_status':
      if (!body.value) return NextResponse.json({ error: 'Statut requis' }, { status: 400 })
      update = { delivery_status: body.value }
      break

    case 'set_carrier_fee': {
      const fee = parseFloat(body.value as string)
      if (isNaN(fee) || fee < 0) return NextResponse.json({ error: 'Frais invalides' }, { status: 400 })
      update = { carrier_fee: fee }
      break
    }

    case 'go_back_to_livraison':
      update = { tracking_status: 'en_livraison' }
      break

    case 'validate_return':
      update = { tracking_status: 'retournee', returned_at: now }
      break

    case 'restore':
      update = { tracking_status: 'en_confirmation', deleted_at: null, cancelled_at: null }
      break

    case 'undo_delete':
      update = { deleted_at: null }
      break

    default:
      return NextResponse.json({ error: `Action inconnue: ${body.action}` }, { status: 400 })
  }

  const { data: updated, error } = await db
    .from('orders')
    .update(update)
    .eq('id', id)
    .select('id, reference, tracking_status, confirmation_status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('order_logs').insert({
    id:         uuid(),
    order_id:   id,
    user_id:    user.sub,
    action:     body.action,
    new_values: update,
  })

  // ── Stock movements ────────────────────────────────────────────────────────
  const o          = order as { boutique_id: string; tracking_status: string; sync_enabled: boolean; reference: string; assigned_carrier_id: string | null }
  const orderRef   = o.reference
  const prevStatus = o.tracking_status

  if (body.action === 'confirm') {
    const items = await getOrderItems(id)
    await deductStockForOrder(id, user.tenantId, user.sub, orderRef, items)
  }

  if (body.action === 'go_back_to_confirmation') {
    const items = await getOrderItems(id)
    await restoreStockForOrder(id, user.tenantId, user.sub, orderRef, 'Retour confirmation commande', items)
  }

  if (body.action === 'cancel' && STOCK_DEDUCTED_STATUSES.has(prevStatus)) {
    const items = await getOrderItems(id)
    await restoreStockForOrder(id, user.tenantId, user.sub, orderRef, 'Annulation commande', items)
  }

  if (body.action === 'validate_return') {
    const items = await getOrderItems(id)
    await restoreStockForOrder(id, user.tenantId, user.sub, orderRef, 'Retour marchandise commande', items)
  }
  // ──────────────────────────────────────────────────────────────────────────

  // ── NOEST carrier integration ──────────────────────────────────────────────
  try {
    const carrierId = body.action === 'dispatch' ? (body.value ?? null) : o.assigned_carrier_id

    if (carrierId && (body.action === 'dispatch' || body.action === 'ship' || body.action === 'request_return')) {
      const { data: carrier } = await db
        .from('carriers')
        .select('platform')
        .eq('id', carrierId)
        .single()

      if ((carrier as { platform: string | null } | null)?.platform?.toLowerCase() === 'noest') {
        if (body.action === 'dispatch') {
          // Create order on NOEST
          const { data: fullOrder } = await db
            .from('orders')
            .select(`
              reference, phone, phone2, address, wilaya_id, total, remark, delivery_method,
              clients!client_id(full_name),
              communes!commune_id(name),
              order_items(product_name, quantity)
            `)
            .eq('id', id)
            .single()

          if (fullOrder) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fo = fullOrder as any
            const produit = (fo.order_items as { product_name: string; quantity: number }[])
              .map((i: { product_name: string; quantity: number }) => i.quantity > 1 ? `${i.product_name} x${i.quantity}` : i.product_name)
              .join(', ') || 'Produit'

            const payload: NoestCreatePayload = {
              reference: fo.reference,
              client:    fo.clients?.full_name ?? fo.phone,
              phone:     fo.phone,
              phone_2:   fo.phone2 ?? undefined,
              adresse:   fo.address ?? '',
              wilaya_id: fo.wilaya_id ?? 16,
              commune:   fo.communes?.name ?? '',
              montant:   fo.total ?? 0,
              remarque:  fo.remark ?? undefined,
              produit,
              type_id:   1,
              stop_desk: fo.delivery_method === 'stopdesk' ? 1 : 0,
            }

            const result = await noestCreateOrder(payload)
            await db.from('order_logs').insert({
              id:         uuid(),
              order_id:   id,
              user_id:    user.sub,
              action:     result.success && result.tracking ? 'noest_push' : 'noest_push_failed',
              new_values: result.success && result.tracking
                ? { noest_tracking: result.tracking }
                : { error: JSON.stringify(result) },
            })
          }
        }

        if (body.action === 'ship') {
          // Validate order on NOEST
          const { data: noestLog } = await db
            .from('order_logs')
            .select('new_values')
            .eq('order_id', id)
            .eq('action', 'noest_push')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const noestTracking = (noestLog?.new_values as { noest_tracking?: string } | null)?.noest_tracking
          if (noestTracking) {
            const result = await noestValidateOrder(noestTracking)
            if (result.success) {
              await db.from('order_logs').insert({
                id: uuid(), order_id: id, user_id: user.sub,
                action: 'noest_validate', new_values: { noest_tracking: noestTracking },
              })
            }
          }
        }

        if (body.action === 'request_return') {
          // Request return on NOEST
          const { data: noestLog } = await db
            .from('order_logs')
            .select('new_values')
            .eq('order_id', id)
            .eq('action', 'noest_push')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const noestTracking = (noestLog?.new_values as { noest_tracking?: string } | null)?.noest_tracking
          if (noestTracking) {
            const result = await noestRequestReturn(noestTracking)
            if (result.success) {
              await db.from('order_logs').insert({
                id: uuid(), order_id: id, user_id: user.sub,
                action: 'noest_return_requested', new_values: { noest_tracking: noestTracking },
              })
            }
          }
        }
      }
    }
  } catch {
    // NOEST errors are non-blocking — order state in DB is already updated
  }
  // ──────────────────────────────────────────────────────────────────────────

  return NextResponse.json(updated)
}

// ── DELETE — hard delete ───────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user   = requireAuth(req)
  const { id } = await params

  const { data: order } = await db
    .from('orders')
    .select('boutique_id')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', (order as { boutique_id: string }).boutique_id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!boutique) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  await db.from('order_items').delete().eq('order_id', id)
  await db.from('order_logs').delete().eq('order_id', id)
  await db.from('orders').delete().eq('id', id)

  return new NextResponse(null, { status: 204 })
}
