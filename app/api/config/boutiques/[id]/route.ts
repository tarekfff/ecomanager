import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params

  const { data, error } = await db
    .from('boutiques')
    .select('id, name, prefix, domain, is_active, created_at')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Boutique introuvable' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const { data: existing } = await db
    .from('boutiques')
    .select('id, prefix')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Boutique introuvable' }, { status: 404 })

  const updates: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    updates.name = name
  }

  if (typeof body.prefix === 'string') {
    const prefix = body.prefix.trim().toUpperCase()
    if (!prefix || prefix.length < 2 || prefix.length > 6)
      return NextResponse.json({ error: 'Le préfixe doit contenir entre 2 et 6 caractères' }, { status: 400 })
    if (!/^[A-Z0-9]+$/.test(prefix))
      return NextResponse.json({ error: 'Le préfixe ne doit contenir que des lettres majuscules et chiffres' }, { status: 400 })

    if (prefix !== (existing as { prefix: string }).prefix) {
      const { data: conflict } = await db
        .from('boutiques')
        .select('id')
        .eq('tenant_id', user.tenantId)
        .eq('prefix', prefix)
        .neq('id', id)
        .maybeSingle()
      if (conflict)
        return NextResponse.json({ error: 'Ce préfixe est déjà utilisé par une autre boutique' }, { status: 400 })
    }
    updates.prefix = prefix
  }

  if (body.domain === null || typeof body.domain === 'string') {
    updates.domain = typeof body.domain === 'string' ? body.domain.trim() || null : null
  }

  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })

  const { data, error } = await db
    .from('boutiques')
    .update(updates)
    .eq('id', id)
    .select('id, name, prefix, domain, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
