import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'config.boutiques')

  const { data: boutiques, error } = await db
    .from('boutiques')
    .select('id, name, prefix, domain, is_active, created_at')
    .eq('tenant_id', user.tenantId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!boutiques || boutiques.length === 0) return NextResponse.json([])

  const boutiqueIds = boutiques.map((b: { id: string }) => b.id)

  const [{ data: ubRows }, { data: orderRows }] = await Promise.all([
    db.from('user_boutiques').select('boutique_id').in('boutique_id', boutiqueIds),
    db.from('orders').select('boutique_id').in('boutique_id', boutiqueIds).is('deleted_at', null),
  ])

  const userCountMap: Record<string, number> = {}
  const orderCountMap: Record<string, number> = {}

  for (const row of ubRows ?? []) {
    userCountMap[row.boutique_id] = (userCountMap[row.boutique_id] ?? 0) + 1
  }
  for (const row of orderRows ?? []) {
    orderCountMap[row.boutique_id] = (orderCountMap[row.boutique_id] ?? 0) + 1
  }

  const result = boutiques.map((b: { id: string; name: string; prefix: string; domain: string | null; is_active: boolean; created_at: string }) => ({
    ...b,
    users_count: userCountMap[b.id] ?? 0,
    orders_count: orderCountMap[b.id] ?? 0,
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'config.boutiques')
  const body = await req.json() as Record<string, unknown>

  const name   = (body.name as string | undefined)?.trim()
  const prefix = (body.prefix as string | undefined)?.trim().toUpperCase()
  const domain = (body.domain as string | undefined)?.trim() || null
  const is_active = body.is_active !== false

  if (!name)   return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  if (!prefix) return NextResponse.json({ error: 'Le préfixe est requis' }, { status: 400 })
  if (prefix.length < 2 || prefix.length > 6)
    return NextResponse.json({ error: 'Le préfixe doit contenir entre 2 et 6 caractères' }, { status: 400 })
  if (!/^[A-Z0-9]+$/.test(prefix))
    return NextResponse.json({ error: 'Le préfixe ne doit contenir que des lettres majuscules et chiffres' }, { status: 400 })

  const { data: conflict } = await db
    .from('boutiques')
    .select('id')
    .eq('tenant_id', user.tenantId)
    .eq('prefix', prefix)
    .maybeSingle()

  if (conflict)
    return NextResponse.json({ error: 'Ce préfixe est déjà utilisé par une autre boutique' }, { status: 400 })

  const { data, error } = await db
    .from('boutiques')
    .insert({
      id: crypto.randomUUID(),
      tenant_id: user.tenantId,
      name,
      prefix,
      domain,
      is_active,
      order_seq: 0,
    })
    .select('id, name, prefix, domain, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, users_count: 0, orders_count: 0 }, { status: 201 })
}
