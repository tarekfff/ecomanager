import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// PUT — change the current user's password. Verifies the old password first.
export async function PUT(req: NextRequest) {
  const user = requireAuth(req)

  const body = await req.json().catch(() => null)
  const oldPassword = body?.old ?? ''
  const newPassword = body?.new ?? ''

  if (!oldPassword || !newPassword) {
    return NextResponse.json({ error: 'Ancien et nouveau mot de passe requis' }, { status: 400 })
  }
  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères' }, { status: 400 })
  }

  const { data: row, error } = await db
    .from('users')
    .select('password_hash')
    .eq('id', user.sub)
    .eq('tenant_id', user.tenantId)
    .single()

  if (error || !row) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const valid = await bcrypt.compare(oldPassword, (row as { password_hash: string }).password_hash)
  if (!valid) return NextResponse.json({ error: 'Ancien mot de passe incorrect' }, { status: 400 })

  const hash = await bcrypt.hash(newPassword, 10)
  const { error: upErr } = await db
    .from('users')
    .update({ password_hash: hash })
    .eq('id', user.sub)

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
