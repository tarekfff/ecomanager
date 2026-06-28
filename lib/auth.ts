import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export interface AuthUser {
  sub:      string   // user UUID
  tenantId: string   // tenant UUID
  email:    string
}

export function requireAuth(req: NextRequest): AuthUser {
  const header = req.headers.get('authorization') ?? ''
  const token  = header.replace('Bearer ', '')
  if (!token) throw new Response('Unauthorized', { status: 401 })
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as AuthUser
  } catch {
    throw new Response('Unauthorized', { status: 401 })
  }
}

export function signToken(payload: AuthUser): string {
  // 30-day session so users stay logged in across browser restarts
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '30d' })
}

// ─── Permission helpers ────────────────────────────────────────────────────────

/** Merge all roles assigned to a user into one flat permissions object.
 *  Super Admin short-circuits and returns {"*": true}. */
export async function getUserPermissions(
  userId: string,
): Promise<Record<string, boolean>> {
  const { data } = await db
    .from('user_roles')
    .select('roles!inner(permissions)')
    .eq('user_id', userId)

  type Row = { roles: { permissions: Record<string, boolean> } }
  const rows = (data ?? []) as unknown as Row[]

  // Super Admin check first (short-circuit)
  for (const row of rows) {
    if (row.roles?.permissions?.['*'] === true) return { '*': true }
  }

  const merged: Record<string, boolean> = {}
  for (const row of rows) {
    const perms = row.roles?.permissions ?? {}
    for (const [k, v] of Object.entries(perms)) {
      if (v === true) merged[k] = true
    }
  }
  return merged
}

/** Check a JWT + permission key. Throws 401 if unauthenticated, 403 if
 *  the user lacks the required permission. Returns the decoded user on success. */
export async function requirePermission(
  req: NextRequest,
  key: string,
): Promise<AuthUser> {
  const user  = requireAuth(req)
  const perms = await getUserPermissions(user.sub)

  if (perms['*'] !== true && perms[key] !== true) {
    throw new Response(
      JSON.stringify({ error: 'Permission refusée' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }
  return user
}

/** Like requirePermission but passes if the user has ANY of the provided keys. */
export async function requireAnyPermission(
  req: NextRequest,
  keys: string[],
): Promise<AuthUser> {
  const user  = requireAuth(req)
  const perms = await getUserPermissions(user.sub)
  if (perms['*'] === true) return user
  if (keys.some(k => perms[k] === true)) return user
  throw new Response(
    JSON.stringify({ error: 'Permission refusée' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } },
  )
}

/** Pure helper — same logic used client-side from PermissionsContext.can(). */
export function hasPermission(
  permissions: Record<string, boolean>,
  key: string,
): boolean {
  return permissions['*'] === true || permissions[key] === true
}
