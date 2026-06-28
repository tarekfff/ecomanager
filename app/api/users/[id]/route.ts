import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

type Ctx = { params: Promise<{ id: string }> }

type UserRow = {
  id: string
  name: string
  email: string
  email_verified: boolean
  two_fa_enabled: boolean
  is_online: boolean
  last_seen_at: string | null
  is_active: boolean
  created_at: string
  user_roles?: { role_id: string; roles: { name: string } | null }[] | null
  user_boutiques?: { boutique_id: string }[] | null
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'config.users')
  const { id } = await params

  const { data, error } = await db
    .from('users')
    .select(`
      id, name, email, email_verified, two_fa_enabled, is_online, last_seen_at, is_active, created_at,
      user_roles(role_id, roles(name)),
      user_boutiques(boutique_id)
    `)
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const u = data as unknown as UserRow
  return NextResponse.json({
    id: u.id,
    name: u.name,
    email: u.email,
    email_verified: u.email_verified,
    two_fa_enabled: u.two_fa_enabled,
    is_online: u.is_online,
    last_seen_at: u.last_seen_at,
    is_active: u.is_active,
    created_at: u.created_at,
    role_ids: (u.user_roles ?? []).map(r => r.role_id),
    role_names: (u.user_roles ?? []).map(r => r.roles?.name).filter(Boolean) as string[],
    boutique_ids: (u.user_boutiques ?? []).map(b => b.boutique_id),
  })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'config.users')
  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const updates: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    updates.name = name
  }

  if (typeof body.email === 'string') {
    const email = body.email.trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'L’email est requis' }, { status: 400 })
    const { data: dup } = await db
      .from('users')
      .select('id')
      .eq('tenant_id', user.tenantId)
      .eq('email', email)
      .neq('id', id)
      .maybeSingle()
    if (dup) return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 409 })
    updates.email = email
  }

  // Only hash + update the password when a non-empty value is provided
  if (typeof body.password === 'string' && body.password.length > 0) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400 })
    }
    updates.password_hash = await bcrypt.hash(body.password, 10)
  }

  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

  if (Object.keys(updates).length > 0) {
    const { error } = await db.from('users').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Replace role assignments if provided
  if (Array.isArray(body.role_ids)) {
    const roleIds = body.role_ids as string[]
    await db.from('user_roles').delete().eq('user_id', id)
    if (roleIds.length > 0) {
      const { error } = await db
        .from('user_roles')
        .insert(roleIds.map(role_id => ({ user_id: id, role_id })))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Replace boutique assignments if provided
  if (Array.isArray(body.boutique_ids)) {
    const boutiqueIds = body.boutique_ids as string[]
    await db.from('user_boutiques').delete().eq('user_id', id)
    if (boutiqueIds.length > 0) {
      const { error } = await db
        .from('user_boutiques')
        .insert(boutiqueIds.map(boutique_id => ({ user_id: id, boutique_id })))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

// Soft delete — disable the account rather than removing the row
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'config.users')
  const { id } = await params

  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const { error } = await db
    .from('users')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
