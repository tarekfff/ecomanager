import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params

  const { data, error } = await db
    .from('roles')
    .select('id, name, permissions, is_system')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Rôle introuvable' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const { data: existing } = await db
    .from('roles')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Rôle introuvable' }, { status: 404 })

  const updates: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    updates.name = name
  }
  if (typeof body.permissions === 'object' && body.permissions !== null) {
    updates.permissions = body.permissions
  }

  const { data, error } = await db
    .from('roles')
    .update(updates)
    .eq('id', id)
    .select('id, name, permissions, is_system')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params

  const { data: existing } = await db
    .from('roles')
    .select('id, is_system')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Rôle introuvable' }, { status: 404 })
  if ((existing as { is_system: boolean }).is_system) {
    return NextResponse.json({ error: 'Impossible de supprimer un rôle système' }, { status: 403 })
  }

  const { error } = await db.from('roles').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
