'use client'

import { Eye } from 'lucide-react'
import OrdersPage, {
  ColDef, BulkActionDef,
  CellRef, CellClient, CellMuted, CellDate, CellTotal, CellStatus, ActionBtn,
} from '@/components/orders/OrdersPage'
import { colors } from '@/lib/tokens'

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
  { key: 'date', label: 'Date', width: 95,
    render: r => <CellDate iso={r.created_at} /> },
  { key: 'total', label: 'Total', width: 110,
    render: r => <CellTotal amount={r.total} /> },
  {
    key: 'actions', label: 'Actions', width: 60,
    render: (r, ctx) => (
      <ActionBtn
        icon={<Eye size={12} />}
        title="Voir"
        onClick={e => { e.stopPropagation(); ctx.openDetail(r.id) }}
        color={colors.textMd}
      />
    ),
  },
]

const BULK_ACTIONS: BulkActionDef[] = []

export default function EncaisseesPage() {
  return (
    <OrdersPage
      title="Encaissées"
      emptyText="Aucune commande encaissée"
      status="encaissee"
      columns={COLUMNS}
      bulkActions={BULK_ACTIONS}
    />
  )
}
