import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(req, 'products.edit')
  const { id: optionTypeId } = await params
  const body = await req.json() as Record<string, unknown>
  const value = (body.value as string | undefined)?.trim()

  if (!value) return NextResponse.json({ error: 'La valeur est requise' }, { status: 400 })

  // Verify ownership via option_types.tenant_id
  const { data: ot } = await db
    .from('option_types')
    .select('id')
    .eq('id', optionTypeId)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!ot) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  // Auto sort_order
  const { count } = await db
    .from('option_values')
    .select('id', { count: 'exact', head: true })
    .eq('option_type_id', optionTypeId)

  const { data, error } = await db
    .from('option_values')
    .insert({ id: uuid(), option_type_id: optionTypeId, value, sort_order: (count ?? 0) + 1 })
    .select('id, value, sort_order')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(req, 'products.edit')
  const { id: optionTypeId } = await params
  const valueId = req.nextUrl.searchParams.get('value_id')

  if (!valueId) return NextResponse.json({ error: 'value_id requis' }, { status: 400 })

  // Verify ownership
  const { data: ot } = await db
    .from('option_types')
    .select('id')
    .eq('id', optionTypeId)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!ot) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const { error } = await db
    .from('option_values')
    .delete()
    .eq('id', valueId)
    .eq('option_type_id', optionTypeId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
