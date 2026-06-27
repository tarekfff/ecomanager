import { db } from './db'
import { v4 as uuid } from 'uuid'

interface OrderItem {
  product_id: string
  variant_id: string | null
  quantity:   number
  unit_cost:  number
}

// ── Fetch order items ──────────────────────────────────────────────────────────

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data } = await db
    .from('order_items')
    .select('product_id, variant_id, quantity, unit_cost')
    .eq('order_id', orderId)
  return ((data ?? []) as OrderItem[])
}

// ── Find fallback warehouse (needed when no batch exists) ──────────────────────

async function fallbackWarehouse(tenantId: string): Promise<string | null> {
  const { data } = await db
    .from('warehouses')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

// ── DEDUCT: remove order items from stock (FIFO by default) ───────────────────

export async function deductStockForOrder(
  orderId:   string,
  tenantId:  string,
  userId:    string,
  orderRef:  string,
  items:     OrderItem[],
) {
  for (const item of items) {
    await deductItem(tenantId, userId, item, orderRef)
  }
}

async function deductItem(
  tenantId: string,
  userId:   string,
  item:     OrderItem,
  orderRef: string,
) {
  // Resolve stock strategy for this product
  const { data: prod } = await db
    .from('products')
    .select('stock_strategy')
    .eq('id', item.product_id)
    .eq('tenant_id', tenantId)
    .single()

  const strategy = (prod as { stock_strategy: string } | null)?.stock_strategy ?? 'fifo'

  // Fetch all active batches with available stock
  let q = db
    .from('stock_batches')
    .select('id, quantity, warehouse_id, unit_cost')
    .eq('product_id', item.product_id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .gt('quantity', 0)

  if (item.variant_id) q = q.eq('variant_id', item.variant_id)

  // Apply strategy ordering
  q = strategy === 'lifo'
    ? q.order('created_at', { ascending: false })
    : q.order('created_at', { ascending: true })  // fifo / fefo / random → FIFO

  const { data: batches } = await q
  const rows = (batches ?? []) as { id: string; quantity: number; warehouse_id: string; unit_cost: number }[]

  let remaining = item.quantity

  for (const batch of rows) {
    if (remaining <= 0) break
    const take   = Math.min(batch.quantity, remaining)
    const newQty = batch.quantity - take

    await db
      .from('stock_batches')
      .update({ quantity: newQty, ...(newQty === 0 ? { is_active: false } : {}) })
      .eq('id', batch.id)

    await db.from('stock_movements').insert({
      id:             uuid(),
      tenant_id:      tenantId,
      product_id:     item.product_id,
      variant_id:     item.variant_id || null,
      warehouse_id:   batch.warehouse_id,
      batch_id:       batch.id,
      user_id:        userId,
      operation_type: 'remove',
      target_type:    'existing_batch',
      quantity:       take,
      unit_cost:      batch.unit_cost,
      comment:        `Commande confirmée #${orderRef}`,
    })

    remaining -= take
  }

  // If stock was insufficient, record the shortfall against the fallback warehouse
  if (remaining > 0) {
    const wid = await fallbackWarehouse(tenantId)
    if (!wid) return  // no warehouse at all — skip silently

    await db.from('stock_movements').insert({
      id:             uuid(),
      tenant_id:      tenantId,
      product_id:     item.product_id,
      variant_id:     item.variant_id || null,
      warehouse_id:   wid,
      batch_id:       null,
      user_id:        userId,
      operation_type: 'remove',
      target_type:    'global',
      quantity:       remaining,
      unit_cost:      item.unit_cost || 0,
      comment:        `Commande confirmée #${orderRef} (stock insuffisant)`,
    })
  }
}

// ── RESTORE: add order items back to stock ────────────────────────────────────

export async function restoreStockForOrder(
  orderId:   string,
  tenantId:  string,
  userId:    string,
  orderRef:  string,
  reason:    string,
  items:     OrderItem[],
) {
  for (const item of items) {
    await restoreItem(tenantId, userId, item, orderRef, reason)
  }
}

async function restoreItem(
  tenantId:  string,
  userId:    string,
  item:      OrderItem,
  orderRef:  string,
  reason:    string,
) {
  // Try to add back to the most recent active batch for this product/variant
  let bq = db
    .from('stock_batches')
    .select('id, warehouse_id, quantity')
    .eq('product_id', item.product_id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)

  if (item.variant_id) bq = bq.eq('variant_id', item.variant_id)

  const { data: existing } = await bq
  const row = (existing ?? [])[0] as { id: string; warehouse_id: string; quantity: number } | undefined

  let warehouseId: string
  let batchId:     string

  if (row) {
    // Add to existing batch
    warehouseId = row.warehouse_id
    batchId     = row.id
    await db
      .from('stock_batches')
      .update({ quantity: row.quantity + item.quantity })
      .eq('id', batchId)
  } else {
    // No active batch — create a new one in the fallback warehouse
    const wid = await fallbackWarehouse(tenantId)
    if (!wid) return  // no warehouse — skip silently

    batchId     = uuid()
    warehouseId = wid
    await db.from('stock_batches').insert({
      id:           batchId,
      tenant_id:    tenantId,
      product_id:   item.product_id,
      variant_id:   item.variant_id || null,
      warehouse_id: warehouseId,
      batch_number: null,
      quantity:     item.quantity,
      unit_cost:    item.unit_cost || 0,
      expiry_date:  null,
      is_active:    true,
    })
  }

  await db.from('stock_movements').insert({
    id:             uuid(),
    tenant_id:      tenantId,
    product_id:     item.product_id,
    variant_id:     item.variant_id || null,
    warehouse_id:   warehouseId,
    batch_id:       batchId,
    user_id:        userId,
    operation_type: 'add',
    target_type:    'existing_batch',
    quantity:       item.quantity,
    unit_cost:      item.unit_cost || 0,
    comment:        `${reason} #${orderRef}`,
  })
}

// ── Statuses where stock was already deducted ──────────────────────────────────
// Used to decide whether cancel should also restore stock

export const STOCK_DEDUCTED_STATUSES = new Set([
  'en_preparation',
  'en_dispatch',
  'en_livraison',
  'livree',
  'en_retour',
])
