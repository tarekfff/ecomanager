import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user        = await requirePermission(req, 'stock.batches')
  const sp          = req.nextUrl.searchParams
  const productId   = sp.get('product_id')   ?? ''
  const warehouseId = sp.get('warehouse_id') ?? ''

  // ── Adjustment-page mode: both IDs provided → simple list for lot picker ──
  if (productId && warehouseId) {
    const { data: product } = await db
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('tenant_id', user.tenantId)
      .is('deleted_at', null)
      .single()

    if (!product) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })

    let query = db
      .from('stock_batches')
      .select('id, batch_number, quantity, unit_cost, expiry_date, created_at, variant_id')
      .eq('product_id', productId)
      .eq('warehouse_id', warehouseId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    const variantId = sp.get('variant_id')
    if (variantId) query = query.eq('variant_id', variantId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  }

  // ── Listing mode: paginated list with joins for the lots page ──────────────
  const page   = Math.max(1, parseInt(sp.get('page')   ?? '1'))
  const limit  = Math.min(100, parseInt(sp.get('limit') ?? '25'))
  const offset = (page - 1) * limit

  let query = db
    .from('stock_batches')
    .select(
      `id, batch_number, quantity, unit_cost, expiry_date, is_active, created_at,
       products!product_id(name, sku),
       product_variants!variant_id(sku),
       warehouses!warehouse_id(name)`,
      { count: 'exact' },
    )
    .eq('tenant_id', user.tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (productId)   query = query.eq('product_id', productId)
  if (warehouseId) query = query.eq('warehouse_id', warehouseId)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data ?? []).map((b: any) => ({
    id:             b.id,
    batch_number:   b.batch_number,
    quantity:       b.quantity,
    unit_cost:      b.unit_cost,
    expiry_date:    b.expiry_date,
    is_active:      b.is_active,
    created_at:     b.created_at,
    product_name:   b.products?.name          ?? '—',
    product_sku:    b.products?.sku           ?? null,
    variant_sku:    b.product_variants?.sku   ?? null,
    warehouse_name: b.warehouses?.name        ?? '—',
  }))

  return NextResponse.json({ items, total: count ?? 0 })
}
