import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db, rpc } from '@/lib/db'
import { v4 as uuid } from 'uuid'

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
  const user = requireAuth(req)
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
  const total        = subtotal + deliveryFee - discount

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
      total,
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
      line_total:   it.unit_price * it.quantity,
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

  return NextResponse.json(order, { status: 201 })
}
