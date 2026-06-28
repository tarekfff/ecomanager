import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

export async function GET(req: NextRequest) {
  const user = requireAuth(req)

  const { data, error } = await db
    .from('brands')
    .select('id, name')
    .eq('tenant_id', user.tenantId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'brands.create')
  const body = await req.json() as Record<string, unknown>
  const name = (body.name as string | undefined)?.trim()

  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  const { data, error } = await db
    .from('brands')
    .insert({ id: uuid(), tenant_id: user.tenantId, name })
    .select('id, name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
