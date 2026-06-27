import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

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
      created_at, confirmed_at, cancelled_at,
      clients!client_id(id, full_name, phone, phone2, email, address),
      wilayas!wilaya_id(name),
      communes!commune_id(name),
      users!assigned_confirmer_id(name),
      carriers!assigned_carrier_id(name),
      order_items(id, product_name, sku, quantity, unit_price, line_total)
    `)
    .eq('id', id)
    .is('deleted_at', null)
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
    created_at:          o.created_at,
    confirmed_at:        o.confirmed_at,
    cancelled_at:        o.cancelled_at,
    client:              o.clients ?? null,
    wilaya_name:         (o.wilayas  as { name: string } | null)?.name ?? null,
    commune_name:        (o.communes as { name: string } | null)?.name ?? null,
    confirmer_name:      (o.users    as { name: string } | null)?.name ?? null,
    carrier_name:        (o.carriers as { name: string } | null)?.name ?? null,
    items:               Array.isArray(o.order_items) ? o.order_items : [],
  })
}

// ── PATCH — status transitions ─────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user   = requireAuth(req)
  const { id } = await params
  const body   = await req.json() as { action: string; value?: string }

  if (!body.action) return NextResponse.json({ error: 'Action requise' }, { status: 400 })

  // Verify ownership
  const { data: order } = await db
    .from('orders')
    .select('boutique_id, tracking_status')
    .eq('id', id)
    .is('deleted_at', null)
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

  return NextResponse.json(updated)
}
