import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user        = requireAuth(req)
  const sp          = req.nextUrl.searchParams
  const productId   = sp.get('product_id')   ?? ''
  const warehouseId = sp.get('warehouse_id') ?? ''

  if (!productId || !warehouseId) return NextResponse.json([])

  // Verify product belongs to this tenant
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
