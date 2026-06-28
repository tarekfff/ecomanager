import { NextRequest, NextResponse } from 'next/server'
import { authWithPermissions, assertPermission, requirePermissionPrefix } from '@/lib/auth'
import { db, rpc } from '@/lib/db'
import { v4 as uuid } from 'uuid'
import { listViewPermForStatus } from '@/lib/permission-maps'
import { fireOrderWebhooks } from '@/lib/webhooks'

export async function GET(req: NextRequest) {
  const { user, perms } = await authWithPermissions(req)
  const sp   = req.nextUrl.searchParams

  const status     = (sp.get('status')      ?? 'en_confirmation').trim()
  // Gate the list by the view permission for the requested pipeline stage
  assertPermission(perms, listViewPermForStatus(status))
  const boutiqueId = (sp.get('boutique_id') ?? '').trim()
  const page       = Math.max(1, parseInt(sp.get('page')  ?? '1'))
  const limit      = Math.min(100, parseInt(sp.get('limit') ?? '25'))
  const search     = (sp.get('search')      ?? '').trim()
  const assignedTo = (sp.get('assigned_to') ?? '').trim()
  const carrierId  = (sp.get('carrier_id')  ?? '').trim()
  const dateFrom   = (sp.get('date_from')   ?? '').trim()
  const dateTo     = (sp.get('date_to')     ?? '').trim()
  // Live cursor — when set, return only orders created strictly after this
  // timestamp (newest first). Used by list pages to stream in new rows.
  const createdAfter = (sp.get('created_after') ?? '').trim()
  const offset     = (page - 1) * limit

  if (!boutiqueId) return NextResponse.json({ items: [], total: 0 })

  // Verify boutique belongs to this tenant
  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', boutiqueId)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable' }, { status: 403 })

  // Pre-fetch matching client IDs for name/phone search
  let clientIds: string[] = []
  if (search) {
    const { data: clientData } = await db
      .from('clients')
      .select('id')
      .eq('tenant_id', user.tenantId)
      .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
      .limit(200)
    clientIds = ((clientData ?? []) as { id: string }[]).map(c => c.id)
  }

  let query = db
    .from('orders')
    .select(
      `id, reference, tracking_status, confirmation_status,
       total, subtotal, delivery_fee, carrier_fee, discount, delivery_method,
       delivery_status, return_risk_score, assigned_confirmer_id,
       created_at, confirmed_at, cancelled_at, dispatched_at, shipped_at, delivered_at, updated_at, deleted_at, sync_enabled, phone,
       clients!client_id(full_name, phone),
       wilayas!wilaya_id(name),
       communes!commune_id(name),
       users!assigned_confirmer_id(name),
       carriers!assigned_carrier_id(name)`,
      { count: 'exact' }
    )
    .eq('boutique_id', boutiqueId)
    .order(status === 'corbeille' ? 'deleted_at' : 'created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Status / deleted filter
  if (status === 'corbeille') {
    query = query.not('deleted_at', 'is', null)
  } else {
    query = query.eq('tracking_status', status).is('deleted_at', null)
  }

  if (search) {
    const orParts = [`reference.ilike.%${search}%`, `phone.ilike.%${search}%`]
    if (clientIds.length > 0) orParts.push(`client_id.in.(${clientIds.join(',')})`)
    query = query.or(orParts.join(','))
  }
  if (assignedTo)    query = query.eq('assigned_confirmer_id', assignedTo)
  if (carrierId)     query = query.eq('assigned_carrier_id', carrierId)
  if (createdAfter)  query = query.gt('created_at', createdAfter)
  if (dateFrom)      query = query.gte('created_at', dateFrom)
  if (dateTo) {
    const end = new Date(dateTo)
    end.setDate(end.getDate() + 1)
    query = query.lt('created_at', end.toISOString())
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Batch-fetch item counts for this page
  const orderIds = ((data ?? []) as { id: string }[]).map(o => o.id)
  const itemCountMap = new Map<string, number>()
  if (orderIds.length > 0) {
    const { data: itemData } = await db
      .from('order_items')
      .select('order_id')
      .in('order_id', orderIds)
    for (const row of (itemData ?? []) as { order_id: string }[]) {
      itemCountMap.set(row.order_id, (itemCountMap.get(row.order_id) ?? 0) + 1)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data ?? []).map((o: any) => ({
    id:                    o.id,
    reference:             o.reference,
    tracking_status:       o.tracking_status,
    confirmation_status:   o.confirmation_status,
    total:                 o.total,
    subtotal:              o.subtotal,
    delivery_fee:          o.delivery_fee,
    discount:              o.discount,
    delivery_method:       o.delivery_method,
    return_risk_score:     o.return_risk_score,
    assigned_confirmer_id: o.assigned_confirmer_id,
    created_at:            o.created_at,
    confirmed_at:          o.confirmed_at,
    dispatched_at:         o.dispatched_at,
    shipped_at:            o.shipped_at,
    delivered_at:          o.delivered_at,
    updated_at:            o.updated_at,
    cancelled_at:          o.cancelled_at,
    deleted_at:            o.deleted_at,
    sync_enabled:          o.sync_enabled,
    delivery_status:       o.delivery_status,
    carrier_fee:           o.carrier_fee,
    phone:                 o.phone,
    client_name:     (o.clients   as { full_name: string } | null)?.full_name ?? null,
    client_phone:    (o.clients   as { phone: string }     | null)?.phone     ?? o.phone,
    wilaya_name:     (o.wilayas   as { name: string }      | null)?.name      ?? null,
    commune_name:    (o.communes  as { name: string }      | null)?.name      ?? null,
    confirmer_name:  (o.users     as { name: string }      | null)?.name      ?? null,
    carrier_name:    (o.carriers  as { name: string }      | null)?.name      ?? null,
    items_count:     itemCountMap.get(o.id) ?? 0,
  }))

  return NextResponse.json({ items, total: count ?? 0 })
}

interface OrderItem {
  product_id:   string
  variant_id:   string | null
  product_name: string
  sku:          string
  quantity:     number
  unit_price:   number
  unit_cost:    number
}

interface OrderBody {
  boutique_id:     string
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
  items:           OrderItem[]
}

export async function POST(req: NextRequest) {
  // Creating an order requires at least one orders.* permission
  const user = await requirePermissionPrefix(req, 'orders')
  const body = await req.json() as OrderBody

  const boutiqueId = body.boutique_id?.trim()
  if (!boutiqueId) return NextResponse.json({ error: 'boutique_id est requis' }, { status: 400 })
  if (!body.phone?.trim()) return NextResponse.json({ error: 'Le téléphone est requis' }, { status: 400 })
  if (!body.full_name?.trim()) return NextResponse.json({ error: 'Le nom complet est requis' }, { status: 400 })
  if (!body.items?.length) return NextResponse.json({ error: 'La commande doit contenir au moins un article' }, { status: 400 })

  // 1. Verify boutique belongs to this tenant
  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', boutiqueId)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable' }, { status: 403 })

  // 2. Upsert client — look up by phone within tenant, create if not found
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
    // Update name/address if provided
    await db.from('clients').update({
      full_name:  body.full_name.trim(),
      phone2:     body.phone2?.trim()   || null,
      email:      body.email?.trim()    || null,
      address:    body.address?.trim()  || null,
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
      phone2:     body.phone2?.trim()   || null,
      email:      body.email?.trim()    || null,
      address:    body.address?.trim()  || null,
      wilaya_id:  body.wilaya_id  ?? null,
      commune_id: body.commune_id ?? null,
    })
    if (clientErr) return NextResponse.json({ error: clientErr.message }, { status: 500 })
  }

  // 3. Generate order reference
  const reference = await rpc<string>('generate_order_reference', { p_boutique_id: boutiqueId })

  // 4. Compute totals
  const subtotal     = body.items.reduce((sum, it) => sum + it.unit_price * it.quantity, 0)
  const deliveryFee  = Number(body.delivery_fee) || 0
  const discount     = Number(body.discount)     || 0

  const orderId = uuid()

  // 5. Insert order
  const { data: order, error: orderErr } = await db
    .from('orders')
    .insert({
      id:              orderId,
      boutique_id:     boutiqueId,
      client_id:       clientId,
      reference,
      tracking_status: 'en_confirmation',
      subtotal,
      delivery_fee:    deliveryFee,
      discount,
      delivery_method: body.delivery_method ?? 'domicile',
      wilaya_id:       body.wilaya_id  ?? null,
      commune_id:      body.commune_id ?? null,
      address:         body.address?.trim()  || null,
      phone,
      phone2:          body.phone2?.trim()   || null,
      referrer:        body.referrer?.trim() || null,
      remark:          body.remark?.trim()   || null,
      source_type:     'manual',
    })
    .select()
    .single()

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 })

  // 6. Insert order items
  const { error: itemsErr } = await db.from('order_items').insert(
    body.items.map(it => ({
      id:           uuid(),
      order_id:     orderId,
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

  // 7. Log creation
  await db.from('order_logs').insert({
    id:         uuid(),
    order_id:   orderId,
    user_id:    user.sub,
    action:     'created',
    new_values: order,
  })

  // 8. Fire OrderCreated webhooks (best-effort)
  await fireOrderWebhooks({
    tenantId:   user.tenantId,
    boutiqueId: boutiqueId,
    orderId,
    action:     'created',
    userId:     user.sub,
  })

  return NextResponse.json(order, { status: 201 })
}
