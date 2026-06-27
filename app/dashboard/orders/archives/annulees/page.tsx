'use client'

import { Eye, RotateCcw, Trash2 } from 'lucide-react'
import OrdersPage, {
  ColDef, BulkActionDef, OrderRow, RenderCtx,
  CellRef, CellClient, CellMuted, CellDate, CellTotal, CellStatus, ActionBtn,
} from '@/components/orders/OrdersPage'
import { colors } from '@/lib/tokens'

function ActionsCell(r: OrderRow, ctx: RenderCtx) {
  async function restore(e: React.MouseEvent) {
    e.stopPropagation()
    const res = await fetch(`/api/orders/${r.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', ...ctx.auth() },
      body:    JSON.stringify({ action: 'restore' }),
    })
    if (res.ok) ctx.refresh()
  }

  async function hardDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm('Supprimer définitivement ? Cette action est irréversible.')) return
    const res = await fetch(`/api/orders/${r.id}`, { method: 'DELETE', headers: ctx.auth() })
    if (res.ok) ctx.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <ActionBtn icon={<Eye size={12} />}      title="Voir"                  onClick={e => { e.stopPropagation(); ctx.openDetail(r.id) }} />
      <ActionBtn icon={<RotateCcw size={12} />} title="Restaurer"            onClick={restore}    color="#1B5E20" />
      <ActionBtn icon={<Trash2 size={12} />}    title="Supprimer définitiv." onClick={hardDelete} color={colors.red} />
    </div>
  )
}

const COLUMNS: ColDef[] = [
  { key: 'reference', label: 'Référence', width: 110,
    render: r => <CellRef reference={r.reference} /> },
  { key: 'client', label: 'Client', width: 150,
    render: r => <CellClient name={r.client_name} /> },
  { key: 'phone', label: 'Téléphone', width: 120,
    render: r => <CellMuted value={r.client_phone ?? r.phone} /> },
  { key: 'wilaya', label: 'Wilaya', width: 100,
    render: r => <CellMuted value={r.wilaya_name} /> },
  { key: 'status', label: 'Statut', width: 130,
    render: r => <CellStatus slug={r.tracking_status} /> },
  { key: 'date', label: 'Annulée le', width: 95,
    render: r => <CellDate iso={r.cancelled_at ?? r.created_at} /> },
  { key: 'total', label: 'Total', width: 110,
    render: r => <CellTotal amount={r.total} /> },
  { key: 'actions', label: 'Actions', width: 100,
    render: ActionsCell },
]

const BULK_ACTIONS: BulkActionDef[] = [
  { id: 'restore',     label: 'Restaurer',               icon: <RotateCcw size={13} />, color: '#1B5E20' },
  { id: 'hard_delete', label: 'Supprimer définitivement', icon: <Trash2 size={13} />,    color: colors.red, dangerous: true },
]

export default function AnnuleesPage() {
  return (
    <OrdersPage
      title="Annulées"
      emptyText="Aucune commande annulée"
      status="annulee"
      columns={COLUMNS}
      bulkActions={BULK_ACTIONS}
    />
  )
}
