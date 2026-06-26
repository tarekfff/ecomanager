import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

export async function GET(req: NextRequest) {
  const user = requireAuth(req)

  const { data, error } = await db
    .from('option_types')
    .select('id, name, sort_order, option_values(id, value, sort_order)')
    .eq('tenant_id', user.tenantId)
    .order('sort_order')
    .order('sort_order', { referencedTable: 'option_values' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req)
  const body = await req.json() as Record<string, unknown>
  const name = (body.name as string | undefined)?.trim()

  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  // Auto sort_order = max + 1
  const { count } = await db
    .from('option_types')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', user.tenantId)

  const { data, error } = await db
    .from('option_types')
    .insert({ id: uuid(), tenant_id: user.tenantId, name, sort_order: (count ?? 0) + 1 })
    .select('id, name, sort_order')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, option_values: [] }, { status: 201 })
}
