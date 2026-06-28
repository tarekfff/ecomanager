import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

type OpType     = 'add' | 'remove' | 'correct'
type TargetType = 'new_batch' | 'global' | 'existing_batch'

interface AdjustBody {
  warehouse_id:   string
  product_id:     string
  variant_id?:    string
  operation_type: OpType
  target_type:    TargetType
  quantity:       number
  unit_cost?:     number
  batch_id?:      string
  batch_number?:  string
  expiry_date?:   string
  comment?:       string
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'stock.adjust')
  const body = await req.json() as AdjustBody

  const {
    warehouse_id, product_id, variant_id,
    operation_type, target_type, quantity,
    unit_cost, batch_id, batch_number, expiry_date, comment,
  } = body

  if (!warehouse_id)   return NextResponse.json({ error: 'Entrepôt requis' }, { status: 400 })
  if (!product_id)     return NextResponse.json({ error: 'Produit requis' }, { status: 400 })
  if (!['add', 'remove', 'correct'].includes(operation_type))
    return NextResponse.json({ error: "Type d'opération invalide" }, { status: 400 })
  if (!['new_batch', 'global', 'existing_batch'].includes(target_type))
    return NextResponse.json({ error: 'Cible invalide' }, { status: 400 })
  if (!quantity || quantity <= 0)
    return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 })
  if (target_type === 'existing_batch' && !batch_id)
    return NextResponse.json({ error: 'Lot requis' }, { status: 400 })

  // Verify product ownership
  const { data: product } = await db
    .from('products')
    .select('id')
    .eq('id', product_id)
    .eq('tenant_id', user.tenantId)
    .is('deleted_at', null)
    .single()

  if (!product) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })

  // 1. Insert stock_movement
  const movId = uuid()
  const { error: movErr } = await db.from('stock_movements').insert({
    id:             movId,
    tenant_id:      user.tenantId,
    product_id,
    variant_id:     variant_id   || null,
    warehouse_id,
    batch_id:       batch_id     || null,
    user_id:        user.sub,
    operation_type,
    target_type,
    quantity:       Math.abs(quantity),
    unit_cost:      unit_cost    ?? null,
    comment:        comment      || null,
  })
  if (movErr) return NextResponse.json({ error: movErr.message }, { status: 500 })

  // 2. If add + new_batch → INSERT stock_batch
  if (operation_type === 'add' && target_type === 'new_batch') {
    const { error: bErr } = await db.from('stock_batches').insert({
      id:           uuid(),
      tenant_id:    user.tenantId,
      product_id,
      variant_id:   variant_id   || null,
      warehouse_id,
      batch_number: batch_number || null,
      quantity:     Math.abs(quantity),
      unit_cost:    unit_cost    ?? 0,
      expiry_date:  expiry_date  || null,
      is_active:    true,
    })
    if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
  }

  // 3. If existing_batch → update batch quantity
  if (target_type === 'existing_batch' && batch_id) {
    if (operation_type === 'correct') {
      // Replace quantity
      const { error: bErr } = await db
        .from('stock_batches')
        .update({ quantity: Math.abs(quantity) })
        .eq('id', batch_id)
        .eq('tenant_id', user.tenantId)
      if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
    } else {
      // Add or remove — fetch current, then increment/decrement
      const { data: batch, error: fetchErr } = await db
        .from('stock_batches')
        .select('quantity')
        .eq('id', batch_id)
        .eq('tenant_id', user.tenantId)
        .single()
      if (fetchErr || !batch)
        return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })

      const delta  = operation_type === 'remove' ? -Math.abs(quantity) : Math.abs(quantity)
      const newQty = Math.max(0, (batch as { quantity: number }).quantity + delta)

      const { error: bErr } = await db
        .from('stock_batches')
        .update({ quantity: newQty })
        .eq('id', batch_id)
        .eq('tenant_id', user.tenantId)
      if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
    }
  }

  // 4. If correct + global → set total stock to the target quantity via delta
  if (operation_type === 'correct' && target_type === 'global') {
    // Fetch all active batches for this product/warehouse (FIFO order)
    let batchQ = db
      .from('stock_batches')
      .select('id, quantity')
      .eq('product_id', product_id)
      .eq('warehouse_id', warehouse_id)
      .eq('tenant_id', user.tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (variant_id) batchQ = batchQ.eq('variant_id', variant_id)

    const { data: existing, error: fetchErr } = await batchQ
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const rows        = (existing ?? []) as { id: string; quantity: number }[]
    const currentTotal = rows.reduce((s, b) => s + b.quantity, 0)
    const target       = Math.abs(quantity)
    const delta        = target - currentTotal

    if (delta > 0) {
      // Add the surplus as a new batch (uses form fields for cost/lot/expiry)
      const { error: bErr } = await db.from('stock_batches').insert({
        id:           uuid(),
        tenant_id:    user.tenantId,
        product_id,
        variant_id:   variant_id   || null,
        warehouse_id,
        batch_number: batch_number || null,
        quantity:     delta,
        unit_cost:    unit_cost    ?? 0,
        expiry_date:  expiry_date  || null,
        is_active:    true,
      })
      if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
    } else if (delta < 0) {
      // Remove the deficit from existing batches FIFO
      let remaining = Math.abs(delta)
      for (const batch of rows) {
        if (remaining <= 0) break
        const reduce = Math.min(batch.quantity, remaining)
        const newQty = batch.quantity - reduce
        const { error: bErr } = await db
          .from('stock_batches')
          .update({ quantity: newQty, ...(newQty === 0 ? { is_active: false } : {}) })
          .eq('id', batch.id)
          .eq('tenant_id', user.tenantId)
        if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 })
        remaining -= reduce
      }
    }
    // delta === 0 → stock already at target, movement log is sufficient
  }

  return NextResponse.json({ id: movId }, { status: 201 })
}
