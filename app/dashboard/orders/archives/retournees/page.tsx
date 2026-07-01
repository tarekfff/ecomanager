'use client'

import { useTranslation } from 'react-i18next'
import { Eye } from 'lucide-react'
import OrdersPage, {
  ColDef, BulkActionDef,
  CellRef, CellClient, CellMuted, CellDate, CellTotal, CellStatus, ActionBtn,
} from '@/components/orders/OrdersPage'
import { colors } from '@/lib/tokens'

export default function RetourneesPage() {
  const { t } = useTranslation('orders')

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
    { key: 'date', label: t('cols.date'), width: 95,
      render: r => <CellDate iso={r.created_at} /> },
    { key: 'total', label: t('cols.total'), width: 110,
      render: r => <CellTotal amount={r.total} /> },
    {
      key: 'actions', label: t('cols.actions'), width: 60,
      render: (r, ctx) => (
        <ActionBtn
          icon={<Eye size={12} />}
          title={t('actions.view')}
          onClick={e => { e.stopPropagation(); ctx.openDetail(r.id) }}
          color={colors.textMd}
        />
      ),
    },
  ]

  const BULK_ACTIONS: BulkActionDef[] = []

  return (
    <OrdersPage
      title={t('retournees.title')}
      emptyText={t('retournees.empty')}
      status="retournee"
      columns={COLUMNS}
      bulkActions={BULK_ACTIONS}
    />
  )
}
