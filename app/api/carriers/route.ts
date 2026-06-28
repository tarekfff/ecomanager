import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

export async function GET(req: NextRequest) {
  const user   = requireAuth(req)
  const sp     = req.nextUrl.searchParams
  const page   = Math.max(1, parseInt(sp.get('page')  ?? '1'))
  const limit  = Math.min(100, parseInt(sp.get('limit') ?? '25'))
  const search = (sp.get('search') ?? '').trim()
  const offset = (page - 1) * limit

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db
    .from('carriers')
    .select(
      'id, name, phone, platform, wilaya_ids, manages_stock, is_active, carrier_boutiques(boutique_id)',
      { count: 'exact' },
    )
    .eq('tenant_id', user.tenantId)
    .order('name')
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const carriers = (data ?? []).map((c: any) => ({
    id:            c.id,
    name:          c.name,
    phone:         c.phone         ?? null,
    platform:      c.platform      ?? null,
    wilaya_ids:    c.wilaya_ids    ?? [],
    manages_stock: c.manages_stock ?? false,
    is_active:     c.is_active     ?? true,
    boutique_ids:  (c.carrier_boutiques ?? []).map((cb: { boutique_id: string }) => cb.boutique_id),
  }))

  return NextResponse.json({ carriers, total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'config.delivery')
  const body = await req.json() as Record<string, unknown>

  const name          = (body.name     as string | undefined)?.trim()
  const phone         = (body.phone    as string | undefined)?.trim() || null
  const platform      = (body.platform as string | undefined)?.trim() || null
  const wilaya_ids    = Array.isArray(body.wilaya_ids)   ? (body.wilaya_ids   as number[]) : []
  const boutique_ids  = Array.isArray(body.boutique_ids) ? (body.boutique_ids as string[]) : []
  const manages_stock = body.manages_stock === true
  const is_active     = body.is_active !== false

  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  const id = uuid()

  const { error } = await db
    .from('carriers')
    .insert({ id, tenant_id: user.tenantId, name, phone, platform, wilaya_ids, manages_stock, is_active })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (boutique_ids.length > 0) {
    await db
      .from('carrier_boutiques')
      .insert(boutique_ids.map(bid => ({ carrier_id: id, boutique_id: bid })))
  }

  const { data: created } = await db
    .from('carriers')
    .select('id, name, phone, platform, wilaya_ids, manages_stock, is_active')
    .eq('id', id)
    .single()

  return NextResponse.json({ ...created, boutique_ids }, { status: 201 })
}
