import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'config.delivery')
  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const { data: existing } = await db
    .from('delivery_statuses')
    .select('id, is_system')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Statut introuvable' }, { status: 404 })

  const updates: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    updates.name = name
    updates.slug = slugify(name)
  }
  if (typeof body.sms_notify === 'boolean') updates.sms_notify = body.sms_notify
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
  if (typeof body.sort_order === 'number') updates.sort_order = body.sort_order

  const { data, error } = await db
    .from('delivery_statuses')
    .update(updates)
    .eq('id', id)
    .select('id, name, slug, sms_notify, is_active, sort_order, is_system')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'config.delivery')
  const { id } = await params

  const { data: existing } = await db
    .from('delivery_statuses')
    .select('id, is_system')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Statut introuvable' }, { status: 404 })
  if ((existing as { is_system: boolean }).is_system) {
    return NextResponse.json({ error: 'Impossible de supprimer un statut système' }, { status: 403 })
  }

  const { error } = await db
    .from('delivery_statuses')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
