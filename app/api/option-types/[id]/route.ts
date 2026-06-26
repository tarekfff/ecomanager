import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(req)
  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const name = (body.name as string | undefined)?.trim()

  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  // Verify ownership
  const { data: existing } = await db
    .from('option_types')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { data, error } = await db
    .from('option_types')
    .update({ name })
    .eq('id', id)
    .select('id, name, sort_order')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireAuth(req)
  const { id } = await params

  // Verify ownership
  const { data: existing } = await db
    .from('option_types')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  // Delete values first (FK), then the type
  await db.from('option_values').delete().eq('option_type_id', id)

  const { error } = await db.from('option_types').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
