import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

// Shape returned to clients — enriched with role names + assigned boutiques.
// Existing consumers (confirmer dropdowns) only read id/name/email, so the
// extra fields are harmless. By default we keep returning active users only;
// the management page passes ?all=1 to also include disabled accounts.
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

export async function GET(req: NextRequest) {
  const user = requireAuth(req)
  const all = req.nextUrl.searchParams.get('all') === '1'

  let q = db
    .from('users')
    .select(`
      id, name, email, email_verified, two_fa_enabled, is_online, last_seen_at, is_active, created_at,
      user_roles(role_id, roles(name)),
      user_boutiques(boutique_id)
    `)
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false })

  if (!all) q = q.eq('is_active', true)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as UserRow[]
  const items = rows.map(u => ({
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
  }))

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'config.users')
  const body = await req.json() as Record<string, unknown>

  const name = (body.name as string | undefined)?.trim()
  const email = (body.email as string | undefined)?.trim().toLowerCase()
  const password = (body.password as string | undefined) ?? ''
  const roleIds = Array.isArray(body.role_ids) ? (body.role_ids as string[]) : []
  const boutiqueIds = Array.isArray(body.boutique_ids) ? (body.boutique_ids as string[]) : []
  const isActive = body.is_active === false ? false : true

  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  if (!email) return NextResponse.json({ error: 'L’email est requis' }, { status: 400 })
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 6 caractères' }, { status: 400 })
  }

  // Reject duplicate email within the tenant
  const { data: dup } = await db
    .from('users')
    .select('id')
    .eq('tenant_id', user.tenantId)
    .eq('email', email)
    .maybeSingle()
  if (dup) return NextResponse.json({ error: 'Cet email est déjà utilisé' }, { status: 409 })

  const password_hash = await bcrypt.hash(password, 10)
  const id = uuid()

  const { error: insErr } = await db
    .from('users')
    .insert({
      id,
      tenant_id: user.tenantId,
      name,
      email,
      password_hash,
      is_active: isActive,
    })

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  if (roleIds.length > 0) {
    const { error } = await db
      .from('user_roles')
      .insert(roleIds.map(role_id => ({ user_id: id, role_id })))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (boutiqueIds.length > 0) {
    const { error } = await db
      .from('user_boutiques')
      .insert(boutiqueIds.map(boutique_id => ({ user_id: id, boutique_id })))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id }, { status: 201 })
}
