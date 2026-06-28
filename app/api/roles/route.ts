import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

export async function GET(req: NextRequest) {
  const user = requireAuth(req)

  const { data, error } = await db
    .from('roles')
    .select('id, name, permissions, is_system')
    .eq('tenant_id', user.tenantId)
    .order('is_system', { ascending: false })
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req)
  const body = await req.json() as Record<string, unknown>

  const name = (body.name as string | undefined)?.trim()
  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  const permissions = (body.permissions as Record<string, boolean> | undefined) ?? {}

  const { data, error } = await db
    .from('roles')
    .insert({
      id: uuid(),
      tenant_id: user.tenantId,
      name,
      permissions,
      is_system: false,
    })
    .select('id, name, permissions, is_system')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
