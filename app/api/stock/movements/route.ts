import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = requireAuth(req)
  const sp   = req.nextUrl.searchParams

  const page          = Math.max(1, parseInt(sp.get('page')            ?? '1'))
  const limit         = Math.min(100, parseInt(sp.get('limit')         ?? '25'))
  const offset        = (page - 1) * limit
  const productId     = sp.get('product_id')     ?? ''
  const warehouseId   = sp.get('warehouse_id')   ?? ''
  const operationType = sp.get('operation_type') ?? ''
  const dateFrom      = sp.get('date_from')      ?? ''
  const dateTo        = sp.get('date_to')        ?? ''

  let query = db
    .from('stock_movements')
    .select(
      `id, operation_type, target_type, quantity, unit_cost, comment, created_at,
       products!product_id(name, sku),
       product_variants!variant_id(sku),
       warehouses!warehouse_id(name),
       users!user_id(name),
       stock_batches!batch_id(batch_number)`,
      { count: 'exact' },
    )
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (productId)     query = query.eq('product_id', productId)
  if (warehouseId)   query = query.eq('warehouse_id', warehouseId)
  if (operationType) query = query.eq('operation_type', operationType)
  if (dateFrom)      query = query.gte('created_at', dateFrom)
  if (dateTo)        query = query.lte('created_at', dateTo + 'T23:59:59.999Z')

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data ?? []).map((m: any) => ({
    id:             m.id,
    operation_type: m.operation_type,
    target_type:    m.target_type,
    quantity:       m.quantity,
    unit_cost:      m.unit_cost,
    comment:        m.comment,
    created_at:     m.created_at,
    product_name:   m.products?.name              ?? '—',
    product_sku:    m.products?.sku               ?? null,
    variant_sku:    m.product_variants?.sku       ?? null,
    warehouse_name: m.warehouses?.name            ?? '—',
    user_name:      m.users?.name                 ?? '—',
    batch_number:   m.stock_batches?.batch_number ?? null,
  }))

  return NextResponse.json({ items, total: count ?? 0 })
}
