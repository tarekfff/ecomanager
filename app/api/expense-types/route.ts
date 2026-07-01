import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

// GET — list all expense types for the tenant
export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'accounting.enter_expenses')

  const { data, error } = await db
    .from('expense_types')
    .select('id, name, is_active')
    .eq('tenant_id', user.tenantId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — create a new expense type { name }
export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'accounting.enter_expenses')

  const body = await req.json().catch(() => null) as { name?: string } | null
  const name = (body?.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  const { data, error } = await db
    .from('expense_types')
    .insert({ tenant_id: user.tenantId, name })
    .select('id, name, is_active')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ce type de charge existe déjà.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE — remove an expense type ?id=
export async function DELETE(req: NextRequest) {
  const user = await requirePermission(req, 'accounting.enter_expenses')

  const id = (req.nextUrl.searchParams.get('id') ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await db
    .from('expense_types')
    .delete()
    .eq('id', id)
    .eq('tenant_id', user.tenantId)

  if (error) {
    // ON DELETE RESTRICT — type still referenced by an expense
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Ce type est utilisé par des dépenses et ne peut pas être supprimé.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
