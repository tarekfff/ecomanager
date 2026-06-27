import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

function skuOrGenericError(err: { code?: string; message: string }) {
  if (err.code === '23505' && err.message.includes('sku')) {
    return { error: 'Ce SKU est déjà utilisé par un autre produit.', field: 'sku' }
  }
  return { error: err.message }
}

export async function GET(req: NextRequest) {
  const user = requireAuth(req)
  const sp   = req.nextUrl.searchParams

  const page       = Math.max(1, parseInt(sp.get('page')    ?? '1'))
  const limit      = Math.min(100, parseInt(sp.get('limit') ?? '25'))
  const search     = (sp.get('search') ?? '').trim()
  const isActive   = sp.get('is_active')
  const boutiqueId = (sp.get('boutique_id') ?? '').trim()
  const offset     = (page - 1) * limit

  if (!boutiqueId) {
    // Search-only mode (e.g. stock management) — return all tenant products matching query
    if (!search) return NextResponse.json({ items: [], total: 0 })

    const { data, error, count } = await db
      .from('products')
      .select('id, name, sku', { count: 'exact' })
      .eq('tenant_id', user.tenantId)
      .is('deleted_at', null)
      .or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
      .order('name')
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (data ?? []).map((p: any) => ({
      id: p.id, name: p.name, sku: p.sku,
      price: 0, compare_price: null, is_active: true,
      brand_name: null, stock_total: 0, created_at: '',
    }))
    return NextResponse.json({ items, total: count ?? 0 })
  }

  // Step 1 — get all product IDs in this boutique (reliable junction-table lookup)
  const { data: pbRows, error: pbErr } = await db
    .from('product_boutiques')
    .select('product_id')
    .eq('boutique_id', boutiqueId)

  if (pbErr) return NextResponse.json({ error: pbErr.message }, { status: 500 })

  const boutiqueProductIds = (pbRows ?? []).map(r => (r as { product_id: string }).product_id)
  if (boutiqueProductIds.length === 0) {
    return NextResponse.json({ items: [], total: 0 })
  }

  // Step 2 — paginated product query filtered by those IDs
  let query = db
    .from('products')
    .select(
      'id, name, sku, barcode, price, compare_price, is_active, created_at, brand_id, ' +
      'brands!brand_id(name)',
      { count: 'exact' },
    )
    .eq('tenant_id', user.tenantId)
    .in('id', boutiqueProductIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
  }
  if (isActive === 'true')  query = query.eq('is_active', true)
  if (isActive === 'false') query = query.eq('is_active', false)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch stock totals for this page's products
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productIds = (data ?? []).map((p: any) => p.id as string)
  const stockMap   = new Map<string, number>()

  if (productIds.length > 0) {
    const { data: stockData } = await db
      .from('stock_batches')
      .select('product_id, quantity')
      .in('product_id', productIds)
      .eq('is_active', true)

    for (const s of (stockData ?? []) as { product_id: string; quantity: number }[]) {
      stockMap.set(s.product_id, (stockMap.get(s.product_id) ?? 0) + s.quantity)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data ?? []).map((p: any) => ({
    id:            p.id,
    name:          p.name,
    sku:           p.sku,
    barcode:       p.barcode,
    price:         p.price,
    compare_price: p.compare_price,
    is_active:     p.is_active,
    created_at:    p.created_at,
    brand_name:    (p.brands as { name: string } | null)?.name ?? null,
    stock_total:   stockMap.get(p.id) ?? 0,
  }))

  return NextResponse.json({ items, total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req)
  const body = await req.json() as Record<string, unknown>

  const name = (body.name as string | undefined)?.trim()
  const sku  = (body.sku  as string | undefined)?.trim()
  const price = Number(body.price)

  if (!name)              return NextResponse.json({ error: 'Le nom du produit est requis' }, { status: 400 })
  if (!sku)               return NextResponse.json({ error: 'Le SKU est requis' }, { status: 400 })
  if (!price || price <= 0) return NextResponse.json({ error: 'Le prix de vente est requis' }, { status: 400 })

  const comparePrice = body.compare_price ? Number(body.compare_price) : null
  if (comparePrice !== null && comparePrice <= price) {
    return NextResponse.json({ error: 'Le prix de comparaison doit être supérieur au prix de vente' }, { status: 400 })
  }

  const productId = uuid()

  const { error: pErr } = await db.from('products').insert({
    id:                    productId,
    tenant_id:             user.tenantId,
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
  })

  if (pErr) return NextResponse.json(skuOrGenericError(pErr), { status: pErr.code === '23505' ? 409 : 500 })

  const boutiqueIds = (body.boutique_ids as string[] | undefined) ?? []
  if (boutiqueIds.length > 0) {
    const { error: bErr } = await db.from('product_boutiques').insert(
      boutiqueIds.map(bid => ({ product_id: productId, boutique_id: bid }))
    )
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
  }

  const deliveryFees = (body.delivery_fees as Array<Record<string, unknown>> | undefined) ?? []
  if (deliveryFees.length > 0) {
    const { error: fErr } = await db.from('product_delivery_fees').insert(
      deliveryFees.map(f => ({
        id:           uuid(),
        product_id:   productId,
        wilaya_id:    f.wilaya_id ? Number(f.wilaya_id) : null,
        pricing_rule: f.pricing_rule ?? 'standard',
        delivery_fee: Number(f.delivery_fee) || 0,
        stopdesk_fee: Number(f.stopdesk_fee) || 0,
      }))
    )
    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })
  }

  const variants = (body.variants as Array<Record<string, unknown>> | undefined) ?? []
  for (const v of variants) {
    const variantId = uuid()
    await db.from('product_variants').insert({
      id:         variantId,
      product_id: productId,
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

  return NextResponse.json({ id: productId }, { status: 201 })
}
