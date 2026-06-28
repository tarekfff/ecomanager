import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export async function GET(req: NextRequest) {
  const user = requireAuth(req)

  const { data, error } = await db
    .from('delivery_statuses')
    .select('id, name, slug, sms_notify, is_active, sort_order, is_system')
    .eq('tenant_id', user.tenantId)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'config.delivery')
  const body = await req.json() as Record<string, unknown>

  const name = (body.name as string | undefined)?.trim()
  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  const sms_notify = body.sms_notify === true

  const { data: maxRow } = await db
    .from('delivery_statuses')
    .select('sort_order')
    .eq('tenant_id', user.tenantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const sort_order = ((maxRow?.sort_order as number | null) ?? -1) + 1

  const { data, error } = await db
    .from('delivery_statuses')
    .insert({
      id: crypto.randomUUID(),
      tenant_id: user.tenantId,
      name,
      slug: slugify(name),
      sms_notify,
      is_active: true,
      is_system: false,
      sort_order,
    })
    .select('id, name, slug, sms_notify, is_active, sort_order, is_system')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
