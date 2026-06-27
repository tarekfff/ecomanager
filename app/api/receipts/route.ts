import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

interface ReceiptBody {
  order_id: string
  type:     'encaissement' | 'retour'
}

export async function GET(req: NextRequest) {
  const user = requireAuth(req)
  const sp         = req.nextUrl.searchParams
  const type       = sp.get('type') as 'encaissement' | 'retour' | null
  const boutiqueId = sp.get('boutique_id') ?? ''
  const status     = sp.get('status') ?? 'pending'

  if (!type || (type !== 'encaissement' && type !== 'retour')) {
    return NextResponse.json({ error: 'type invalide' }, { status: 400 })
  }
  if (!boutiqueId) {
    return NextResponse.json({ error: 'boutique_id requis' }, { status: 400 })
  }

  const { data, error } = await db
    .from('receipts')
    .select(`
      id, order_id, carrier_id, type, status, amount, created_at,
      orders!inner(
        reference, total, carrier_fee, boutique_id,
        boutiques!inner(tenant_id),
        clients!client_id(full_name)
      ),
      carriers(name)
    `)
    .eq('type', type)
    .eq('status', status)
    .eq('orders.boutique_id', boutiqueId)
    .eq('orders.boutiques.tenant_id', user.tenantId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []).map((r: any) => ({
    id:           r.id,
    order_id:     r.order_id,
    carrier_id:   r.carrier_id ?? null,
    amount:       r.amount ?? 0,
    created_at:   r.created_at,
    reference:    r.orders?.reference ?? '',
    total:        r.orders?.total ?? 0,
    carrier_fee:  r.orders?.carrier_fee ?? 0,
    client_name:  r.orders?.clients?.full_name ?? '',
    carrier_name: r.carriers?.name ?? 'Sans livreur',
  }))

  rows.sort((a: { carrier_name: string }, b: { carrier_name: string }) =>
    a.carrier_name.localeCompare(b.carrier_name, 'fr')
  )

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req)
  const body = await req.json() as ReceiptBody

  const { order_id, type } = body
  if (!order_id) return NextResponse.json({ error: 'order_id requis' }, { status: 400 })
  if (type !== 'encaissement' && type !== 'retour') {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }

  // Fetch order — verify it belongs to this tenant via boutiques
  const { data: order } = await db
    .from('orders')
    .select(`
      id, assigned_carrier_id, total, carrier_fee,
      boutiques!inner(tenant_id)
    `)
    .eq('id', order_id)
    .is('deleted_at', null)
    .single()

  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyOrder = order as any
  const boutiqueTenantId: string | undefined = Array.isArray(anyOrder.boutiques)
    ? anyOrder.boutiques[0]?.tenant_id
    : anyOrder.boutiques?.tenant_id
  if (boutiqueTenantId !== user.tenantId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const o = order as any
  const amount = type === 'encaissement'
    ? Math.max(0, (o.total ?? 0) - (o.carrier_fee ?? 0))
    : 0

  const { data, error } = await db
    .from('receipts')
    .insert({
      id:         uuid(),
      order_id,
      carrier_id: o.assigned_carrier_id ?? null,
      type,
      status:     'pending',
      amount,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
