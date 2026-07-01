'use client'

import { useTranslation } from 'react-i18next'
import { Eye, RotateCcw, Trash2 } from 'lucide-react'
import OrdersPage, {
  ColDef, BulkActionDef, OrderRow, RenderCtx,
  CellRef, CellClient, CellMuted, CellDate, CellTotal, CellStatus, ActionBtn,
} from '@/components/orders/OrdersPage'
import { colors } from '@/lib/tokens'

export default function CorbeillePage() {
  const { t } = useTranslation('orders')

  function ActionsCell(r: OrderRow, ctx: RenderCtx) {
    async function undoDelete(e: React.MouseEvent) {
      e.stopPropagation()
      const res = await fetch(`/api/orders/${r.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...ctx.auth() },
        body:    JSON.stringify({ action: 'undo_delete' }),
      })
      if (res.ok) ctx.refresh()
    }

    async function hardDelete(e: React.MouseEvent) {
      e.stopPropagation()
      if (!window.confirm(t('bulk.confirmHardDelete'))) return
      const res = await fetch(`/api/orders/${r.id}`, { method: 'DELETE', headers: ctx.auth() })
      if (res.ok) ctx.refresh()
    }

    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <ActionBtn icon={<Eye size={12} />}       title={t('actions.view')}      onClick={e => { e.stopPropagation(); ctx.openDetail(r.id) }} />
        <ActionBtn icon={<RotateCcw size={12} />}  title={t('actions.undoDelete')} onClick={undoDelete}  color="#1B5E20" />
        <ActionBtn icon={<Trash2 size={12} />}     title={t('actions.hardDelete')} onClick={hardDelete} color={colors.red} />
      </div>
    )
  }

  const COLUMNS: ColDef[] = [
    { key: 'reference', label: t('cols.reference'), width: 110,
      render: r => <CellRef reference={r.reference} /> },
    { key: 'client', label: t('cols.client'), width: 150,
      render: r => <CellClient name={r.client_name} /> },
    { key: 'phone', label: t('cols.phone'), width: 120,
      render: r => <CellMuted value={r.client_phone ?? r.phone} /> },
    { key: 'wilaya', label: t('cols.wilaya'), width: 100,
      render: r => <CellMuted value={r.wilaya_name} /> },
    { key: 'status', label: t('cols.status'), width: 130,
      render: r => <CellStatus slug={r.tracking_status} /> },
    { key: 'date', label: t('cols.deletedAt'), width: 105,
      render: r => <CellDate iso={r.deleted_at} /> },
    { key: 'total', label: t('cols.total'), width: 110,
      render: r => <CellTotal amount={r.total} /> },
    { key: 'actions', label: t('cols.actions'), width: 100,
      render: ActionsCell },
  ]

  const BULK_ACTIONS: BulkActionDef[] = [
    { id: 'undo_delete', label: t('bulk.undoDelete'), icon: <RotateCcw size={13} />, color: '#1B5E20' },
    { id: 'hard_delete', label: t('bulk.hardDelete'), icon: <Trash2 size={13} />,    color: colors.red, dangerous: true },
  ]

  return (
    <OrdersPage
      title={t('corbeille.title')}
      emptyText={t('corbeille.empty')}
      status="corbeille"
      columns={COLUMNS}
      bulkActions={BULK_ACTIONS}
    />
  )
}
