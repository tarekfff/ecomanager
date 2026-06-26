import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

const SELECT_FIELDS =
  'id, full_name, phone, phone2, email, address, wilaya_id, commune_id, ' +
  'orders_delivered, orders_returned, orders_cancelled, created_at'

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params

  const { data, error } = await db
    .from('clients')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params
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

  // Verify ownership before updating
  const { data: existing } = await db
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const { data, error } = await db
    .from('clients')
    .update({ full_name, phone, phone2, email, address, wilaya_id, commune_id })
    .eq('id', id)
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params

  const { error } = await db
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('tenant_id', user.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
