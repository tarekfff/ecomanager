import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const { email, password } = body ?? {}

  if (!email || !password) {
    return NextResponse.json({ error: 'Email et mot de passe requis' }, { status: 400 })
  }

  const { data: user, error } = await db
    .from('users')
    .select('id, tenant_id, name, email, password_hash, is_active')
    .eq('email', email)
    .single()

  if (error || !user || !user.is_active) {
    return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Identifiants incorrects' }, { status: 401 })
  }

  const token = signToken({ sub: user.id, tenantId: user.tenant_id, email: user.email })

  return NextResponse.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, tenant_id: user.tenant_id },
  })
}
