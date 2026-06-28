import { NextRequest, NextResponse } from 'next/server'
import { authWithPermissions, assertPermission } from '@/lib/auth'
import { db } from '@/lib/db'

interface BulkConfirmBody {
  carrier_id: string | null
  type:       'encaissement' | 'retour'
  order_ids:  string[]
}

export async function POST(req: NextRequest) {
  const { user, perms } = await authWithPermissions(req)
  const body = await req.json() as BulkConfirmBody
  const { type, order_ids } = body

  if (!type || (type !== 'encaissement' && type !== 'retour')) {
    return NextResponse.json({ error: 'type invalide' }, { status: 400 })
  }

  // Confirming a bon requires the matching bon confirm permission
  assertPermission(perms, type === 'retour' ? 'orders.bon_retour.confirm' : 'orders.bon_encaissement.confirm')
  if (!Array.isArray(order_ids) || order_ids.length === 0) {
    return NextResponse.json({ error: 'order_ids requis' }, { status: 400 })
  }
  if (order_ids.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 commandes par bon' }, { status: 400 })
  }

  // Verify all orders belong to this tenant
  const { data: orders } = await db
    .from('orders')
    .select('id, boutiques!inner(tenant_id)')
    .in('id', order_ids)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allOwned = (orders ?? []).every((o: any) => {
    const tid = Array.isArray(o.boutiques) ? o.boutiques[0]?.tenant_id : o.boutiques?.tenant_id
    return tid === user.tenantId
  })
  if (!allOwned || (orders ?? []).length !== order_ids.length) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const now = new Date().toISOString()

  // Confirm all pending receipts for these orders
  const { error: receiptError } = await db
    .from('receipts')
    .update({
      status:       'confirmed',
      confirmed_by: user.sub,
      confirmed_at: now,
    })
    .in('order_id', order_ids)
    .eq('type', type)
    .eq('status', 'pending')

  if (receiptError) return NextResponse.json({ error: receiptError.message }, { status: 500 })

  // Advance order tracking status
  const newStatus  = type === 'encaissement' ? 'encaissee' : 'retournee'
  const timestampCol = type === 'encaissement' ? 'paid_at' : 'returned_at'

  const { error: orderError } = await db
    .from('orders')
    .update({ tracking_status: newStatus, [timestampCol]: now })
    .in('id', order_ids)

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 })

  return NextResponse.json({ confirmed: order_ids.length })
}
