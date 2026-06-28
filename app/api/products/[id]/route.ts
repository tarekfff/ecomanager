import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const user   = await requirePermission(req, 'products.view')
  const { id } = await params

  const { data, error } = await db
    .from('products')
    .select(`
      id, name, sku, barcode, price, compare_price, is_active,
      out_of_stock_behavior, stock_alert_enabled, stock_alert_min, stock_strategy,
      external_link, confirmer_notes, weight_g, length_cm, width_cm, height_cm,
      brand_id, created_at,
      brands!brand_id(name),
      product_boutiques(boutique_id),
      product_delivery_fees(id, wilaya_id, pricing_rule, delivery_fee, stopdesk_fee),
      product_variants(id, sku, price, is_active, variant_options(option_value_id))
    `)
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .is('deleted_at', null)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user   = await requirePermission(req, 'products.edit')
  const { id } = await params
  const body   = await req.json() as Record<string, unknown>

  // Verify ownership
  const { data: existing } = await db
    .from('products')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })

  // Soft-delete shortcut (from the list page trash action)
  if (Object.keys(body).length === 1 && 'deleted_at' in body) {
    const { error } = await db
      .from('products')
      .update({ deleted_at: body.deleted_at })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ id })
  }

  // Full update — validate required fields
  const name  = (body.name as string | undefined)?.trim()
  const sku   = (body.sku  as string | undefined)?.trim()
  const price = Number(body.price)

  if (!name)               return NextResponse.json({ error: 'Le nom du produit est requis' }, { status: 400 })
  if (!sku)                return NextResponse.json({ error: 'Le SKU est requis' }, { status: 400 })
  if (!price || price <= 0) return NextResponse.json({ error: 'Le prix de vente est requis' }, { status: 400 })

  const comparePrice = body.compare_price ? Number(body.compare_price) : null
  if (comparePrice !== null && comparePrice <= price) {
    return NextResponse.json({ error: 'Le prix de comparaison doit être supérieur au prix de vente' }, { status: 400 })
  }

  const { error: pErr } = await db.from('products').update({
    name,
    sku,
    barcode:               (body.barcode as string | undefined)?.trim() || null,
    brand_id:              body.brand_id || null,
    price,
    compare_price:         comparePrice,
    out_of_stock_behavior: body.out_of_stock_behavior ?? 'allow',
    stock_alert_enabled:   body.stock_alert_enabled ?? false,
    stock_alert_min:       body.stock_alert_min ? Number(body.stock_alert_min) : null,
    stock_strategy:        body.stock_strategy ?? 'fifo',
    external_link:         (body.external_link as string | undefined)?.trim() || null,
    confirmer_notes:       (body.confirmer_notes as string | undefined)?.trim() || null,
    weight_g:              body.weight_g  ? Number(body.weight_g)  : null,
    length_cm:             body.length_cm ? Number(body.length_cm) : null,
    width_cm:              body.width_cm  ? Number(body.width_cm)  : null,
    height_cm:             body.height_cm ? Number(body.height_cm) : null,
    is_active:             body.is_active ?? true,
  }).eq('id', id)

  if (pErr) {
    if (pErr.code === '23505' && pErr.message.includes('sku')) {
      return NextResponse.json(
        { error: 'Ce SKU est déjà utilisé par un autre produit.', field: 'sku' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  // Replace boutique associations
  await db.from('product_boutiques').delete().eq('product_id', id)
  const boutiqueIds = (body.boutique_ids as string[] | undefined) ?? []
  if (boutiqueIds.length > 0) {
    await db.from('product_boutiques').insert(
      boutiqueIds.map(bid => ({ product_id: id, boutique_id: bid }))
    )
  }

  // Replace delivery fees
  await db.from('product_delivery_fees').delete().eq('product_id', id)
  const deliveryFees = (body.delivery_fees as Array<Record<string, unknown>> | undefined) ?? []
  if (deliveryFees.length > 0) {
    await db.from('product_delivery_fees').insert(
      deliveryFees.map(f => ({
        id:           uuid(),
        product_id:   id,
        wilaya_id:    f.wilaya_id ? Number(f.wilaya_id) : null,
        pricing_rule: f.pricing_rule ?? 'standard',
        delivery_fee: Number(f.delivery_fee) || 0,
        stopdesk_fee: Number(f.stopdesk_fee) || 0,
      }))
    )
  }

  // Replace variants — delete variant_options first (FK), then variants, then re-insert
  const { data: oldVars } = await db
    .from('product_variants')
    .select('id')
    .eq('product_id', id)

  const oldVarIds = (oldVars ?? []).map((v: { id: string }) => v.id)
  if (oldVarIds.length > 0) {
    await db.from('variant_options').delete().in('variant_id', oldVarIds)
  }
  await db.from('product_variants').delete().eq('product_id', id)

  const variants = (body.variants as Array<Record<string, unknown>> | undefined) ?? []
  for (const v of variants) {
    const variantId = uuid()
    await db.from('product_variants').insert({
      id:         variantId,
      product_id: id,
      sku:        v.sku,
      price:      v.price || null,
      is_active:  v.is_active ?? true,
    })
    const valueIds = (v.option_value_ids as string[] | undefined) ?? []
    if (valueIds.length > 0) {
      await db.from('variant_options').insert(
        valueIds.map(ovid => ({ variant_id: variantId, option_value_id: ovid }))
      )
    }
  }

  return NextResponse.json({ id })
}
