import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getUserPermissions } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const auth = requireAuth(req)

  const { data: user, error } = await db
    .from('users')
    .select('id, tenant_id, name, email, email_verified, two_fa_enabled, is_online, last_seen_at, is_active')
    .eq('id', auth.sub)
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }

  const { data: boutiques } = await db
    .from('boutiques')
    .select('id, name, prefix, domain, is_active, user_boutiques!inner(user_id)')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .eq('user_boutiques.user_id', auth.sub)
    .order('name')

  // Merge all role permissions for this user so the client can gate UI elements
  const permissions = await getUserPermissions(auth.sub)

  return NextResponse.json({ user, boutiques: boutiques ?? [], permissions })
}
