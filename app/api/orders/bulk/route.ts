import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

type BulkAction = 'confirm' | 'cancel' | 'delete' | 'assign' | 'set_confirmation_status'

interface BulkBody {
  ids:    string[]
  action: BulkAction
  value?: string
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req)
  const body = await req.json() as BulkBody

  const { ids, action, value } = body
  if (!ids?.length) return NextResponse.json({ error: 'Aucune commande sélectionnée' }, { status: 400 })
  if (!action)      return NextResponse.json({ error: 'Action requise' }, { status: 400 })

  // Verify all orders belong to this tenant's boutiques
  const { data: tenantBoutiques } = await db
    .from('boutiques')
    .select('id')
    .eq('tenant_id', user.tenantId)

  const tenantBoutiqueIds = new Set(
    ((tenantBoutiques ?? []) as { id: string }[]).map(b => b.id)
  )

  const { data: orderData } = await db
    .from('orders')
    .select('id, boutique_id')
    .in('id', ids)

  const verifiedIds = ((orderData ?? []) as { id: string; boutique_id: string }[])
    .filter(o => tenantBoutiqueIds.has(o.boutique_id))
    .map(o => o.id)

  if (verifiedIds.length === 0) {
    return NextResponse.json({ error: 'Commandes introuvables ou non autorisées' }, { status: 403 })
  }

  const now = new Date().toISOString()

  switch (action) {
    case 'confirm':
      await db.from('orders')
        .update({ tracking_status: 'en_preparation', confirmed_at: now })
        .in('id', verifiedIds)
      break

    case 'cancel':
      await db.from('orders')
        .update({ tracking_status: 'annulee', cancelled_at: now })
        .in('id', verifiedIds)
      break

    case 'delete':
      await db.from('orders')
        .update({ deleted_at: now })
        .in('id', verifiedIds)
      break

    case 'assign':
      if (!value) return NextResponse.json({ error: 'ID utilisateur requis' }, { status: 400 })
      // Verify the user belongs to the same tenant
      const { data: targetUser } = await db
        .from('users')
        .select('id')
        .eq('id', value)
        .eq('tenant_id', user.tenantId)
        .single()
      if (!targetUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
      await db.from('orders')
        .update({ assigned_confirmer_id: value })
        .in('id', verifiedIds)
      break

    case 'set_confirmation_status':
      if (!value) return NextResponse.json({ error: 'Statut requis' }, { status: 400 })
      await db.from('orders')
        .update({ confirmation_status: value })
        .in('id', verifiedIds)
      break

    default:
      return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 })
  }

  return NextResponse.json({ updated: verifiedIds.length })
}
