import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// PUT — update the current user's profile (name only; email is read-only).
export async function PUT(req: NextRequest) {
  const user = requireAuth(req)

  const body = await req.json().catch(() => null)
  const name = (body?.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  const { data, error } = await db
    .from('users')
    .update({ name })
    .eq('id', user.sub)
    .eq('tenant_id', user.tenantId)
    .select('id, name, email')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
