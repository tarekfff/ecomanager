import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

type BulkAction =
  | 'confirm' | 'cancel' | 'delete' | 'assign' | 'set_confirmation_status'
  | 'dispatch' | 'assign_carrier' | 'ship' | 'disable_sync'
  | 'deliver' | 'request_return' | 'set_carrier_fee'
  | 'go_back_to_livraison' | 'validate_return'
  | 'prepare_encaissement' | 'prepare_retour'

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

    case 'dispatch': {
      if (!value) return NextResponse.json({ error: 'Transporteur requis' }, { status: 400 })
      const { data: carrier } = await db
        .from('carriers')
        .select('id')
        .eq('id', value)
        .eq('tenant_id', user.tenantId)
        .eq('is_active', true)
        .single()
      if (!carrier) return NextResponse.json({ error: 'Transporteur introuvable' }, { status: 404 })
      await db.from('orders')
        .update({ tracking_status: 'en_dispatch', assigned_carrier_id: value, dispatched_at: now })
        .in('id', verifiedIds)
      break
    }

    case 'assign_carrier': {
      if (!value) return NextResponse.json({ error: 'Transporteur requis' }, { status: 400 })
      const { data: carrier } = await db
        .from('carriers')
        .select('id')
        .eq('id', value)
        .eq('tenant_id', user.tenantId)
        .eq('is_active', true)
        .single()
      if (!carrier) return NextResponse.json({ error: 'Transporteur introuvable' }, { status: 404 })
      await db.from('orders')
        .update({ assigned_carrier_id: value })
        .in('id', verifiedIds)
      break
    }

    case 'ship':
      await db.from('orders')
        .update({ tracking_status: 'en_livraison', shipped_at: now })
        .in('id', verifiedIds)
      break

    case 'disable_sync':
      await db.from('orders')
        .update({ sync_enabled: false })
        .in('id', verifiedIds)
      break

    case 'deliver':
      await db.from('orders')
        .update({ tracking_status: 'livree', delivered_at: now })
        .in('id', verifiedIds)
      break

    case 'request_return':
      await db.from('orders')
        .update({ tracking_status: 'en_retour' })
        .in('id', verifiedIds)
      break

    case 'set_carrier_fee': {
      const fee = parseFloat(value ?? '')
      if (isNaN(fee) || fee < 0) return NextResponse.json({ error: 'Frais invalides' }, { status: 400 })
      await db.from('orders')
        .update({ carrier_fee: fee })
        .in('id', verifiedIds)
      break
    }

    case 'go_back_to_livraison':
      await db.from('orders')
        .update({ tracking_status: 'en_livraison' })
        .in('id', verifiedIds)
      break

    case 'validate_return':
      await db.from('orders')
        .update({ tracking_status: 'retournee', returned_at: now })
        .in('id', verifiedIds)
      break

    case 'prepare_encaissement':
    case 'prepare_retour': {
      const receiptType = action === 'prepare_encaissement' ? 'encaissement' : 'retour'
      const { data: orderDetails } = await db
        .from('orders')
        .select('id, assigned_carrier_id, total, carrier_fee')
        .in('id', verifiedIds)
      if (orderDetails && orderDetails.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = (orderDetails as any[]).map(o => ({
          id:         uuid(),
          order_id:   o.id,
          carrier_id: o.assigned_carrier_id ?? null,
          type:       receiptType,
          status:     'pending',
          amount:     receiptType === 'encaissement'
            ? Math.max(0, (o.total ?? 0) - (o.carrier_fee ?? 0))
            : 0,
        }))
        await db.from('receipts').insert(rows)
      }
      break
    }

    default:
      return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 })
  }

  return NextResponse.json({ updated: verifiedIds.length })
}
