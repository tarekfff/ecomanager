import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

const TRANSITIONS: Record<string, { next: string; col: string }> = {
  validate_collect:    { next: 'collecte', col: 'collected_at' },
  validate_reception:  { next: 'recu',     col: 'received_at' },
  validate_processing: { next: 'traite',   col: 'processed_at' },
  cancel:              { next: 'annule',   col: 'cancelled_at' },
}

// Where each status goes when go_back is clicked
const GO_BACK: Record<string, string> = {
  collecte: 'en_collecte',
  recu:     'collecte',
  traite:   'recu',
  annule:   'en_collecte',
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireAuth(req)
  const { id } = await params
  const body = await req.json() as { action: string }
  const { action } = body

  if (!action) return NextResponse.json({ error: 'action requise' }, { status: 400 })

  // Verify pickup belongs to this tenant
  const { data: pickup } = await db
    .from('pickups')
    .select('id, status, sync_enabled, orders!inner(boutiques!inner(tenant_id))')
    .eq('id', id)
    .single()

  if (!pickup) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyP = pickup as any
  const boutiques = anyP.orders?.boutiques
  const tid = Array.isArray(boutiques) ? boutiques[0]?.tenant_id : boutiques?.tenant_id
  if (tid !== user.tenantId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const currentStatus = anyP.status as string

  if (action === 'go_back') {
    const prev = GO_BACK[currentStatus]
    if (!prev) return NextResponse.json({ error: 'Retour non disponible depuis ce statut' }, { status: 400 })
    const { error } = await db.from('pickups').update({ status: prev }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ status: prev })
  }

  if (action === 'toggle_sync') {
    const { error } = await db
      .from('pickups')
      .update({ sync_enabled: !anyP.sync_enabled })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ sync_enabled: !anyP.sync_enabled })
  }

  const transition = TRANSITIONS[action]
  if (!transition) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  }

  const { error } = await db
    .from('pickups')
    .update({ status: transition.next, [transition.col]: now })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: transition.next })
}
