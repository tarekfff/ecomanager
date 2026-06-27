import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'
import {
  noestCreateOrder,
  noestValidateOrder,
  noestRequestReturn,
  noestRequestNewAttempt,
  noestGetTrackingInfo,
  NoestCreatePayload,
} from '@/lib/noest'

type Ctx = { params: Promise<{ id: string }> }

// ── Helpers ────────────────────────────────────────────────────────────────────

async function verifyOrderTenant(orderId: string, tenantId: string) {
  const { data: order } = await db
    .from('orders')
    .select('boutique_id, assigned_carrier_id, phone, phone2, address, wilaya_id, commune_id, total, remark, delivery_method, reference')
    .eq('id', orderId)
    .single()

  if (!order) return null

  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', (order as { boutique_id: string }).boutique_id)
    .eq('tenant_id', tenantId)
    .single()

  if (!boutique) return null

  return order as {
    boutique_id:         string
    assigned_carrier_id: string | null
    phone:               string
    phone2:              string | null
    address:             string | null
    wilaya_id:           number | null
    commune_id:          number | null
    total:               number
    remark:              string | null
    delivery_method:     string
    reference:           string
  }
}

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

// ── GET — NOEST tracking status for this order ────────────────────────────────

export async function GET(req: NextRequest, { params }: Ctx) {
  const user   = requireAuth(req)
  const { id } = await params

  const order = await verifyOrderTenant(id, user.tenantId)
  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const noestTracking = await getNoestTracking(id)
  if (!noestTracking) {
    return NextResponse.json({ noest_tracking: null, activity: [], delivery_attempts: [] })
  }

  try {
    const info = await noestGetTrackingInfo([noestTracking])
    const data = info[noestTracking]
    return NextResponse.json({
      noest_tracking:     noestTracking,
      order_info:         data?.OrderInfo         ?? null,
      activity:           data?.activity           ?? [],
      delivery_attempts:  data?.deliveryAttempts   ?? [],
    })
  } catch {
    return NextResponse.json({ noest_tracking: noestTracking, activity: [], delivery_attempts: [] })
  }
}

// ── POST — manual NOEST actions ────────────────────────────────────────────────

interface PostBody { action: 'push' | 'validate' | 'return' | 'new_attempt' }

export async function POST(req: NextRequest, { params }: Ctx) {
  const user   = requireAuth(req)
  const { id } = await params
  const body   = await req.json() as PostBody

  const order = await verifyOrderTenant(id, user.tenantId)
  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  switch (body.action) {

    // ── Push order to NOEST ──────────────────────────────────────────────────
    case 'push': {
      const { data: fullOrder } = await db
        .from('orders')
        .select(`
          reference, phone, phone2, address, wilaya_id, commune_id,
          total, remark, delivery_method,
          clients!client_id(full_name),
          communes!commune_id(name),
          order_items(product_name, quantity)
        `)
        .eq('id', id)
        .single()

      if (!fullOrder) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fo = fullOrder as any
      const produit = (fo.order_items as { product_name: string; quantity: number }[])
        .map(i => i.quantity > 1 ? `${i.product_name} x${i.quantity}` : i.product_name)
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

      if (result.success && result.tracking) {
        await db.from('order_logs').insert({
          id:         uuid(),
          order_id:   id,
          user_id:    user.sub,
          action:     'noest_push',
          new_values: { noest_tracking: result.tracking },
        })
        return NextResponse.json({ success: true, noest_tracking: result.tracking })
      }

      return NextResponse.json(
        { success: false, error: result },
        { status: 422 },
      )
    }

    // ── Validate order on NOEST ──────────────────────────────────────────────
    case 'validate': {
      const tracking = await getNoestTracking(id)
      if (!tracking) return NextResponse.json({ error: 'Aucun tracking NOEST — commande non envoyée à NOEST' }, { status: 400 })

      const result = await noestValidateOrder(tracking)
      if (result.success) {
        await db.from('order_logs').insert({
          id:         uuid(),
          order_id:   id,
          user_id:    user.sub,
          action:     'noest_validate',
          new_values: { noest_tracking: tracking },
        })
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ success: false, error: result }, { status: 422 })
    }

    // ── Request return on NOEST ──────────────────────────────────────────────
    case 'return': {
      const tracking = await getNoestTracking(id)
      if (!tracking) return NextResponse.json({ error: 'Aucun tracking NOEST' }, { status: 400 })

      const result = await noestRequestReturn(tracking)
      if (result.success) {
        await db.from('order_logs').insert({
          id:         uuid(),
          order_id:   id,
          user_id:    user.sub,
          action:     'noest_return_requested',
          new_values: { noest_tracking: tracking },
        })
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ success: false, error: result }, { status: 422 })
    }

    // ── Request new delivery attempt ─────────────────────────────────────────
    case 'new_attempt': {
      const tracking = await getNoestTracking(id)
      if (!tracking) return NextResponse.json({ error: 'Aucun tracking NOEST' }, { status: 400 })

      const result = await noestRequestNewAttempt(tracking)
      if (result.success) {
        await db.from('order_logs').insert({
          id:         uuid(),
          order_id:   id,
          user_id:    user.sub,
          action:     'noest_new_attempt',
          new_values: { noest_tracking: tracking },
        })
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ success: false, error: result }, { status: 422 })
    }

    default:
      return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  }
}
