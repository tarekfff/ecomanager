import { NextRequest, NextResponse } from 'next/server'
import { authWithPermissions, assertPermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { pickupViewPermForStatus } from '@/lib/permission-maps'

export async function GET(req: NextRequest) {
  const { user, perms } = await authWithPermissions(req)
  const sp         = req.nextUrl.searchParams
  const status     = sp.get('status') ?? ''
  const boutiqueId = sp.get('boutique_id') ?? ''
  const page       = Math.max(1, parseInt(sp.get('page')  ?? '1'))
  const limit      = Math.min(100, parseInt(sp.get('limit') ?? '25'))
  const search     = (sp.get('search') ?? '').trim()
  const offset     = (page - 1) * limit

  if (!status || !boutiqueId) {
    return NextResponse.json({ error: 'status et boutique_id requis' }, { status: 400 })
  }

  // Gate the pickups list by the view permission for the requested status
  assertPermission(perms, pickupViewPermForStatus(status))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db
    .from('pickups')
    .select(`
      id, order_id, carrier_id, status, sync_enabled,
      collected_at, received_at, processed_at, cancelled_at, created_at,
      orders!inner(
        reference, total, boutique_id,
        boutiques!inner(tenant_id),
        clients!client_id(full_name),
        wilayas(name)
      ),
      carriers(name)
    `, { count: 'exact' })
    .eq('status', status)
    .eq('orders.boutique_id', boutiqueId)
    .eq('orders.boutiques.tenant_id', user.tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.ilike('orders.reference', `%${search}%`)
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data ?? []).map((p: any) => ({
    id:           p.id,
    order_id:     p.order_id,
    carrier_id:   p.carrier_id  ?? null,
    status:       p.status,
    sync_enabled: p.sync_enabled ?? false,
    created_at:   p.created_at,
    collected_at:  p.collected_at  ?? null,
    received_at:   p.received_at   ?? null,
    processed_at:  p.processed_at  ?? null,
    cancelled_at:  p.cancelled_at  ?? null,
    reference:    p.orders?.reference  ?? '',
    total:        p.orders?.total      ?? 0,
    client_name:  p.orders?.clients?.full_name ?? null,
    carrier_name: p.carriers?.name     ?? null,
    wilaya_name:  p.orders?.wilayas?.name ?? null,
  }))

  return NextResponse.json({ items, total: count ?? 0 })
}
