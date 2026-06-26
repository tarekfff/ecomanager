import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

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
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' })
}
