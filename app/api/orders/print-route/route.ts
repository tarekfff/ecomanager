import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

interface PrintBody {
  order_ids: string[]
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'orders.en_dispatch.print_route')
  const body = await req.json() as PrintBody

  if (!body.order_ids?.length) {
    return NextResponse.json({ error: 'Aucune commande sélectionnée' }, { status: 400 })
  }
  if (body.order_ids.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 commandes par impression' }, { status: 400 })
  }

  // Get tenant boutique IDs for tenant-scoping
  const { data: boutiques } = await db
    .from('boutiques')
    .select('id')
    .eq('tenant_id', user.tenantId)

  const boutiqueIds = new Set(((boutiques ?? []) as { id: string }[]).map(b => b.id))

  const { data, error } = await db
    .from('orders')
    .select(`
      id, reference, phone, address, total, delivery_method, remark, boutique_id,
      clients!client_id(full_name),
      wilayas!wilaya_id(name),
      communes!commune_id(name),
      carriers!assigned_carrier_id(name)
    `)
    .in('id', body.order_ids)
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders = ((data ?? []) as any[])
    .filter(o => boutiqueIds.has(o.boutique_id))
    .map(o => ({
      reference:       o.reference,
      client_name:     (o.clients  as { full_name: string } | null)?.full_name ?? null,
      phone:           o.phone,
      wilaya:          (o.wilayas  as { name: string }      | null)?.name      ?? null,
      commune:         (o.communes as { name: string }      | null)?.name      ?? null,
      address:         o.address,
      total:           o.total,
      delivery_method: o.delivery_method,
      carrier_name:    (o.carriers as { name: string }      | null)?.name      ?? null,
      remark:          o.remark,
    }))

  return NextResponse.json({ orders })
}
