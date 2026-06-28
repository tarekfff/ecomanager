import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionPrefix, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

// Valid webhook events (19 total) — keep in sync with the frontend list
const VALID_EVENTS = new Set([
  'OrderCreated', 'OrderConfirmed', 'OrderDispatched', 'OrderShipped', 'OrderDelivered',
  'OrderFailed', 'OrderPaid', 'OrderReturned', 'OrderCanceled', 'OrderDeleted',
  'OrderStatusChanged', 'OrderConfirmationStatusChanged', 'OrderShippingStatusChanged',
  'OrderTrackingStatusChanged', 'OrderAddressChanged', 'OrderItemsChanged',
  'OrderRestored', 'OrderConfirmerChanged', 'OrderCarrierChanged',
])

export async function GET(req: NextRequest) {
  // Listing webhooks requires at least one webhooks.* permission
  const user = await requirePermissionPrefix(req, 'webhooks')

  const { data, error } = await db
    .from('webhooks')
    .select('id, name, event, url, secret, boutique_ids, is_active, created_at')
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve boutique names for the tenant, then map each webhook's ids → names
  const { data: boutiques } = await db
    .from('boutiques')
    .select('id, name')
    .eq('tenant_id', user.tenantId)

  const nameById = new Map<string, string>(
    (boutiques ?? []).map((b: { id: string; name: string }) => [b.id, b.name]),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webhooks = (data ?? []).map((w: any) => ({
    ...w,
    boutique_ids: w.boutique_ids ?? [],
    boutique_names: (w.boutique_ids ?? [])
      .map((id: string) => nameById.get(id))
      .filter(Boolean),
  }))

  return NextResponse.json(webhooks)
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'webhooks.create')
  const body = await req.json() as Record<string, unknown>

  const name  = (body.name as string | undefined)?.trim()
  const event = (body.event as string | undefined)?.trim()
  const url   = (body.url as string | undefined)?.trim()
  const secret = (body.secret as string | undefined)?.trim() || uuid()
  const boutique_ids = Array.isArray(body.boutique_ids) ? body.boutique_ids as string[] : []
  const is_active = body.is_active !== false

  if (!name)  return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  if (!event) return NextResponse.json({ error: "L'événement est requis" }, { status: 400 })
  if (!VALID_EVENTS.has(event)) return NextResponse.json({ error: 'Événement invalide' }, { status: 400 })
  if (!url)   return NextResponse.json({ error: "L'URL est requise" }, { status: 400 })

  const { data, error } = await db
    .from('webhooks')
    .insert({
      id: uuid(),
      tenant_id: user.tenantId,
      name, event, url, secret, boutique_ids, is_active,
    })
    .select('id, name, event, url, secret, boutique_ids, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
