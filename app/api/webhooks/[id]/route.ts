import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionPrefix, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

const VALID_EVENTS = new Set([
  'OrderCreated', 'OrderConfirmed', 'OrderDispatched', 'OrderShipped', 'OrderDelivered',
  'OrderFailed', 'OrderPaid', 'OrderReturned', 'OrderCanceled', 'OrderDeleted',
  'OrderStatusChanged', 'OrderConfirmationStatusChanged', 'OrderShippingStatusChanged',
  'OrderTrackingStatusChanged', 'OrderAddressChanged', 'OrderItemsChanged',
  'OrderRestored', 'OrderConfirmerChanged', 'OrderCarrierChanged',
])

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await requirePermissionPrefix(req, 'webhooks')
  const { id } = await params

  const { data, error } = await db
    .from('webhooks')
    .select('id, name, event, url, secret, boutique_ids, is_active, created_at')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Webhook introuvable' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'webhooks.edit')
  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  // Verify ownership
  const { data: existing } = await db
    .from('webhooks')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Webhook introuvable' }, { status: 404 })

  // Build a partial update from the provided fields
  const update: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = (body.name as string).trim()
    if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    update.name = name
  }
  if (body.event !== undefined) {
    const event = (body.event as string).trim()
    if (!VALID_EVENTS.has(event)) return NextResponse.json({ error: 'Événement invalide' }, { status: 400 })
    update.event = event
  }
  if (body.url !== undefined) {
    const url = (body.url as string).trim()
    if (!url) return NextResponse.json({ error: "L'URL est requise" }, { status: 400 })
    update.url = url
  }
  if (body.secret !== undefined) update.secret = (body.secret as string).trim()
  if (body.boutique_ids !== undefined) {
    update.boutique_ids = Array.isArray(body.boutique_ids) ? body.boutique_ids : []
  }
  if (body.is_active !== undefined) update.is_active = !!body.is_active

  const { data, error } = await db
    .from('webhooks')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .select('id, name, event, url, secret, boutique_ids, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'webhooks.delete')
  const { id } = await params

  const { data: existing } = await db
    .from('webhooks')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Webhook introuvable' }, { status: 404 })

  const { error } = await db
    .from('webhooks')
    .delete()
    .eq('id', id)
    .eq('tenant_id', user.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
