import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'config.clients')
  const sp   = req.nextUrl.searchParams

  const page     = Math.max(1, parseInt(sp.get('page')     ?? '1'))
  const limit    = Math.min(100, parseInt(sp.get('limit')  ?? '25'))
  const search   = (sp.get('search')   ?? '').trim()
  const wilayaId = sp.get('wilaya_id')
  const offset   = (page - 1) * limit

  let query = db
    .from('clients')
    .select(
      'id, full_name, phone, phone2, email, address, wilaya_id, commune_id, ' +
      'orders_delivered, orders_returned, orders_cancelled, created_at, ' +
      'wilayas!wilaya_id(name)',
      { count: 'exact' },
    )
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
  }
  if (wilayaId) {
    query = query.eq('wilaya_id', parseInt(wilayaId))
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten the nested wilaya join into a plain wilaya_name field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clients = (data ?? []).map((c: any) => ({
    ...c,
    wilaya_name: (c.wilayas as { name: string } | null)?.name ?? null,
    wilayas: undefined,
  }))

  return NextResponse.json({ clients, total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'config.clients')
  const body = await req.json() as Record<string, unknown>

  const full_name  = (body.full_name  as string | undefined)?.trim()
  const phone      = (body.phone      as string | undefined)?.trim()
  const phone2     = (body.phone2     as string | undefined)?.trim()  || null
  const email      = (body.email      as string | undefined)?.trim()  || null
  const address    = (body.address    as string | undefined)?.trim()  || null
  const wilaya_id  = body.wilaya_id  ? parseInt(body.wilaya_id  as string) : null
  const commune_id = body.commune_id ? parseInt(body.commune_id as string) : null

  if (!full_name || !phone) {
    return NextResponse.json({ error: 'Nom complet et téléphone sont requis' }, { status: 400 })
  }

  const { data, error } = await db
    .from('clients')
    .insert({
      id: uuid(),
      tenant_id: user.tenantId,
      full_name, phone, phone2, email, address, wilaya_id, commune_id,
    })
    .select('id, full_name, phone, phone2, email, address, wilaya_id, commune_id, orders_delivered, orders_returned, orders_cancelled, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
