import { NextRequest, NextResponse } from 'next/server'
import { authWithPermissions, assertPermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'
import {
  getOrderItems,
  deductStockForOrder,
  restoreStockForOrder,
  STOCK_DEDUCTED_STATUSES,
} from '@/lib/stock-order'
import { bulkActionPerm } from '@/lib/permission-maps'
import { fireOrderWebhooks, shouldFireWebhooks, resolveCarrierForWebhook } from '@/lib/webhooks'
import { notifyOrderDelivered, notifyOrderReturned } from '@/lib/notifications'

type BulkAction =
  | 'confirm' | 'cancel' | 'delete' | 'assign' | 'set_confirmation_status'
  | 'dispatch' | 'assign_carrier' | 'ship' | 'disable_sync'
  | 'deliver' | 'request_return' | 'set_carrier_fee'
  | 'go_back_to_livraison' | 'validate_return'
  | 'prepare_encaissement' | 'prepare_retour'
  | 'restore' | 'undo_delete' | 'hard_delete'

interface BulkBody {
  ids:        string[]
  action:     BulkAction
  value?:     string
  webhook_id?: string   // dispatch via a saved livraison-société webhook
}

export async function POST(req: NextRequest) {
  const { user, perms } = await authWithPermissions(req)
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
    .select('id, boutique_id, tracking_status')
    .in('id', ids)

  const verifiedOrders = ((orderData ?? []) as { id: string; boutique_id: string; tracking_status: string }[])
    .filter(o => tenantBoutiqueIds.has(o.boutique_id))
  const verifiedIds = verifiedOrders.map(o => o.id)

  if (verifiedIds.length === 0) {
    return NextResponse.json({ error: 'Commandes introuvables ou non autorisées' }, { status: 403 })
  }

  // Gate the bulk action by the (action, stage) permission. For stage-dependent
  // actions we require the permission for EVERY distinct stage in the selection,
  // so a user can never bulk-affect an order in a stage they can't act on.
  const stages = Array.from(new Set(verifiedOrders.map(o => o.tracking_status)))
  for (const stage of stages) {
    const requiredPerm = bulkActionPerm(action, stage)
    if (!requiredPerm) return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 })
    assertPermission(perms, requiredPerm)
  }

  const now = new Date().toISOString()
  const webhookId = body.webhook_id?.trim() || undefined
  // Set when dispatching via a saved webhook → used to fire that exact webhook.
  let dispatchWebhookId: string | undefined

  switch (action) {
    case 'confirm': {
      await db.from('orders')
        .update({ tracking_status: 'en_preparation', confirmed_at: now })
        .in('id', verifiedIds)
      // Fetch references once, then deduct stock per order
      const { data: refs } = await db
        .from('orders')
        .select('id, reference')
        .in('id', verifiedIds)
      for (const o of (refs ?? []) as { id: string; reference: string }[]) {
        const items = await getOrderItems(o.id)
        await deductStockForOrder(o.id, user.tenantId, user.sub, o.reference, items)
      }
      break
    }

    case 'cancel': {
      // Fetch current statuses before updating so we know which orders had stock deducted
      const { data: preCancel } = await db
        .from('orders')
        .select('id, reference, tracking_status')
        .in('id', verifiedIds)
      await db.from('orders')
        .update({ tracking_status: 'annulee', cancelled_at: now })
        .in('id', verifiedIds)
      for (const o of (preCancel ?? []) as { id: string; reference: string; tracking_status: string }[]) {
        if (STOCK_DEDUCTED_STATUSES.has(o.tracking_status)) {
          const items = await getOrderItems(o.id)
          await restoreStockForOrder(o.id, user.tenantId, user.sub, o.reference, 'Annulation commande', items)
        }
      }
      break
    }

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
      // New flow: dispatch via a saved livraison-société webhook.
      if (webhookId) {
        const boutiqueIds = Array.from(new Set(verifiedOrders.map(o => o.boutique_id)))
        const carrierByBoutique = new Map<string, string>()
        for (const bId of boutiqueIds) {
          const resolved = await resolveCarrierForWebhook(user.tenantId, bId, webhookId)
          if (!resolved) return NextResponse.json({ error: 'Société de livraison introuvable' }, { status: 404 })
          carrierByBoutique.set(bId, resolved.carrierId)
        }
        // Assign each order its boutique's carrier
        for (const [bId, carrierId] of carrierByBoutique) {
          const idsForBoutique = verifiedOrders.filter(o => o.boutique_id === bId).map(o => o.id)
          await db.from('orders')
            .update({ tracking_status: 'en_dispatch', assigned_carrier_id: carrierId, dispatched_at: now })
            .in('id', idsForBoutique)
        }
        dispatchWebhookId = webhookId
        break
      }

      // Legacy flow: dispatch via a carrier id.
      if (!value) return NextResponse.json({ error: 'Société de livraison requise' }, { status: 400 })
      const { data: carrier } = await db
        .from('carriers')
        .select('id')
        .eq('id', value)
        .eq('tenant_id', user.tenantId)
        .eq('is_active', true)
        .single()
      if (!carrier) return NextResponse.json({ error: 'Société de livraison introuvable' }, { status: 404 })
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

    case 'deliver': {
      await db.from('orders')
        .update({ tracking_status: 'livree', delivered_at: now })
        .in('id', verifiedIds)
      const { data: delRefs } = await db
        .from('orders')
        .select('reference')
        .in('id', verifiedIds)
      for (const o of (delRefs ?? []) as { reference: string }[]) {
        await notifyOrderDelivered(user.tenantId, o.reference)
      }
      break
    }

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

    case 'validate_return': {
      await db.from('orders')
        .update({ tracking_status: 'retournee', returned_at: now })
        .in('id', verifiedIds)
      const { data: retRefs } = await db
        .from('orders')
        .select('id, reference')
        .in('id', verifiedIds)
      for (const o of (retRefs ?? []) as { id: string; reference: string }[]) {
        const items = await getOrderItems(o.id)
        await restoreStockForOrder(o.id, user.tenantId, user.sub, o.reference, 'Retour marchandise commande', items)
        await notifyOrderReturned(user.tenantId, o.reference)
      }
      break
    }

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

    case 'restore':
      await db.from('orders')
        .update({ tracking_status: 'en_confirmation', deleted_at: null, cancelled_at: null })
        .in('id', verifiedIds)
      break

    case 'undo_delete':
      await db.from('orders')
        .update({ deleted_at: null })
        .in('id', verifiedIds)
      break

    case 'hard_delete':
      await db.from('order_items').delete().in('order_id', verifiedIds)
      await db.from('order_logs').delete().in('order_id', verifiedIds)
      await db.from('orders').delete().in('id', verifiedIds)
      break

    default:
      return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 })
  }

  // ── Webhooks (generic + NOEST livraison société) ────────────────────────────
  // Fire saved webhooks for each affected order. Best-effort; never blocks.
  if (action !== 'hard_delete' && shouldFireWebhooks(action)) {
    await Promise.all(verifiedOrders.map(o =>
      fireOrderWebhooks({
        tenantId:   user.tenantId,
        boutiqueId: o.boutique_id,
        orderId:    o.id,
        action,
        userId:     user.sub,
        webhookId:  action === 'dispatch' ? dispatchWebhookId : undefined,
      }),
    ))
  }

  return NextResponse.json({ updated: verifiedIds.length })
}
