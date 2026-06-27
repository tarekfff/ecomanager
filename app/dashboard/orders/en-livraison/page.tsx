'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye, Pencil, X, AlertCircle,
  XCircle, WifiOff, Package,
  Calendar, Wifi, Truck, PackageCheck, RotateCcw, CreditCard,
} from 'lucide-react'
import { PageHeader, Button, SearchInput, Select, Pagination } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'
import { useBoutique } from '@/contexts/BoutiqueContext'
import OrderDetailPanel from '@/components/orders/OrderDetailPanel'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Order {
  id:              string
  reference:       string
  tracking_status: string
  delivery_status: string | null
  total:           number
  phone:           string
  client_name:     string | null
  client_phone:    string | null
  wilaya_name:     string | null
  carrier_name:    string | null
  shipped_at:      string | null
  sync_enabled:    boolean
  items_count:     number
}

interface Carrier        { id: string; name: string; boutique_ids?: string[] }
interface DeliveryStatus { id: string; name: string; slug: string }

// ── Constants ──────────────────────────────────────────────────────────────────

const LIMIT = 25

// Default badge colors for system delivery status slugs
const DELIV_COLORS: Record<string, { color: string; bg: string }> = {
  ne_repond_pas:  { color: '#E65100', bg: '#FFF3E0' },
  tel_eteint:     { color: '#6A1B9A', bg: '#F3E5F5' },
  reportee:       { color: '#1565C0', bg: '#E3F2FD' },
  annulee_client: { color: '#B71C1C', bg: '#FFEBEE' },
  autre:          { color: '#546E7A', bg: '#ECEFF1' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-DZ', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

function fmtAmount(n: number) {
  return n.toLocaleString('fr-DZ') + ' DA'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Checkbox({
  checked, indeterminate, onChange,
}: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref} type="checkbox" checked={checked} onChange={onChange}
      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: colors.primary }}
    />
  )
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '9px 10px', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ height: 12, borderRadius: 3, background: '#ececec', width: i === 0 ? 14 : `${55 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function EnLivraisonPage() {
  const router         = useRouter()
  const { boutiqueId } = useBoutique()

  const [orders,  setOrders]  = useState<Order[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)

  const [search,        setSearch]        = useState('')
  const [dbSearch,      setDbSearch]      = useState('')
  const [filterCarrier, setFilterCarrier] = useState('')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')

  const [carriers,        setCarriers]        = useState<Carrier[]>([])
  const [deliveryStatuses, setDeliveryStatuses] = useState<DeliveryStatus[]>([])

  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [bulkLoading,    setBulkLoading]    = useState(false)
  const [bulkError,      setBulkError]      = useState('')
  const [bulkCarrierFee, setBulkCarrierFee] = useState('')

  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load carriers & delivery statuses when boutique changes ───────────────

  useEffect(() => {
    if (!boutiqueId) { setCarriers([]); return }
    fetch('/api/carriers?limit=100', { headers: authHeader() })
      .then(r => r.json())
      .then((d: { carriers?: Carrier[] }) => {
        const list = d.carriers ?? []
        setCarriers(list.filter(c => !c.boutique_ids?.length || c.boutique_ids.includes(boutiqueId)))
      })
      .catch(() => {})
  }, [boutiqueId])

  useEffect(() => {
    fetch('/api/delivery-statuses', { headers: authHeader() })
      .then(r => r.json())
      .then((d: DeliveryStatus[]) => { if (Array.isArray(d)) setDeliveryStatuses(d) })
      .catch(() => {})
  }, [])

  // ── Fetch orders ──────────────────────────────────────────────────────────

  const fetchOrders = useCallback(() => {
    if (!boutiqueId) return
    setLoading(true)
    const qs = new URLSearchParams({
      status:      'en_livraison',
      boutique_id: boutiqueId,
      page:        String(page),
      limit:       String(LIMIT),
      search:      dbSearch,
    })
    if (filterCarrier) qs.set('carrier_id', filterCarrier)
    if (dateFrom)      qs.set('date_from', dateFrom)
    if (dateTo)        qs.set('date_to', dateTo)

    fetch(`/api/orders?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => { setOrders(d.items ?? []); setTotal(d.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boutiqueId, page, dbSearch, filterCarrier, dateFrom, dateTo])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ── Search debounce ───────────────────────────────────────────────────────

  function handleSearchChange(val: string) {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDbSearch(val); setPage(1) }, 300)
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === orders.length && orders.length > 0) setSelectedIds(new Set())
    else setSelectedIds(new Set(orders.map(o => o.id)))
  }

  function clearSelection() { setSelectedIds(new Set()); setBulkError('') }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  async function bulkAction(action: string, value?: string) {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    setBulkError('')
    try {
      const res = await fetch('/api/orders/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body:    JSON.stringify({ ids: Array.from(selectedIds), action, value }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setBulkError(data.error ?? 'Erreur'); return }
      setSelectedIds(new Set())
      fetchOrders()
    } finally {
      setBulkLoading(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const allSelected  = orders.length > 0 && selectedIds.size === orders.length
  const someSelected = selectedIds.size > 0 && !allSelected
  const nSelected    = selectedIds.size

  const carrierOptions = [
    { value: '', label: 'Tous les livreurs' },
    ...carriers.map(c => ({ value: c.id, label: c.name })),
  ]

  // Build slug → name map from loaded delivery statuses
  const delivStatusMap = new Map(deliveryStatuses.map(s => [s.slug, s.name]))

  // ── Table helpers ─────────────────────────────────────────────────────────

  const TH = ({ children, width, center }: { children: React.ReactNode; width?: number; center?: boolean }) => (
    <th style={{
      fontSize: 11.5, fontWeight: 600, color: colors.textMd,
      padding: '8px 10px', textAlign: center ? 'center' : 'left',
      whiteSpace: 'nowrap', width, background: '#f5f5f5',
    }}>
      {children}
    </th>
  )

  const TD = ({ children, center, muted }: { children: React.ReactNode; center?: boolean; muted?: boolean }) => (
    <td style={{
      fontSize: 12.5, padding: '8px 10px',
      color: muted ? colors.textMd : colors.text,
      borderBottom: `1px solid ${colors.border}`,
      textAlign: center ? 'center' : 'left',
      verticalAlign: 'middle',
    }}>
      {children}
    </td>
  )

  const COLS = 10

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="En livraison"
        subtitle={
          total > 0
            ? `${total} commande${total > 1 ? 's' : ''} en cours de livraison`
            : 'Commandes en cours de livraison'
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => router.push('/dashboard/orders/new')}>
            + Nouvelle commande
          </Button>
        }
      />

      <div style={{
        flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column',
        padding: '12px 16px', gap: 10, fontFamily: fonts.sans,
      }}>

        {!boutiqueId && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff8e1', border: '1px solid #ffe082',
            borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#795548',
          }}>
            <AlertCircle size={15} />
            Sélectionnez une boutique dans la barre de navigation.
          </div>
        )}

        {/* ── Filter bar ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', maxWidth: 260 }}>
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Réf., téléphone, client…"
            />
          </div>

          <div style={{ width: 190 }}>
            <Select
              value={filterCarrier}
              onChange={v => { setFilterCarrier(v); setPage(1) }}
              options={carrierOptions}
              placeholder="Tous les livreurs"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: colors.textMd, whiteSpace: 'nowrap' }}>De</label>
            <input
              type="date" value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              style={{
                border: `1px solid ${colors.border}`, borderRadius: 4,
                padding: '6px 8px', fontSize: 12.5, fontFamily: fonts.sans,
                color: dateFrom ? colors.text : colors.textLt, outline: 'none', background: '#fff',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
              onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: colors.textMd }}>À</label>
            <input
              type="date" value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
              style={{
                border: `1px solid ${colors.border}`, borderRadius: 4,
                padding: '6px 8px', fontSize: 12.5, fontFamily: fonts.sans,
                color: dateTo ? colors.text : colors.textLt, outline: 'none', background: '#fff',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
              onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
            />
          </div>

          {(dateFrom || dateTo || filterCarrier) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setFilterCarrier(''); setPage(1) }}
              style={{
                fontSize: 12, color: colors.textLt, background: 'none', border: 'none',
                cursor: 'pointer', padding: '4px 6px', textDecoration: 'underline',
              }}
            >
              Effacer filtres
            </button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 12, color: colors.textMd, whiteSpace: 'nowrap' }}>
            {loading ? '…' : `${total} résultat${total !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* ── Bulk action bar ──────────────────────────────────────────────── */}
        {nSelected > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            background: colors.primaryLt, border: `1px solid ${colors.primary}33`,
            borderRadius: 6, padding: '8px 12px',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.primary, marginRight: 4 }}>
              {nSelected} sélectionné{nSelected > 1 ? 's' : ''}
            </span>

            {/* Valider livraison */}
            <BulkBtn
              icon={<PackageCheck size={13} />}
              label="Valider livraison"
              onClick={() => bulkAction('deliver')}
              loading={bulkLoading}
              color="#1B5E20"
            />

            {/* Demander retour */}
            <BulkBtn
              icon={<RotateCcw size={13} />}
              label="Demander retour"
              onClick={() => bulkAction('request_return')}
              loading={bulkLoading}
              color={colors.red}
            />

            {/* Modifier frais livreur */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input
                type="number"
                min={0}
                placeholder="Frais DA"
                value={bulkCarrierFee}
                onChange={e => setBulkCarrierFee(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{
                  width: 88, padding: '4px 7px', fontSize: 12,
                  border: `1px solid ${colors.border}`, borderRadius: 4,
                  fontFamily: fonts.sans, outline: 'none', background: '#fff',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
                onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
              />
              <BulkBtn
                icon={<CreditCard size={13} />}
                label="Appliquer frais"
                onClick={() => {
                  if (!bulkCarrierFee) { setBulkError('Entrez un montant'); return }
                  bulkAction('set_carrier_fee', bulkCarrierFee)
                }}
                loading={bulkLoading}
              />
            </div>

            {/* Désactiver sync */}
            <BulkBtn
              icon={<WifiOff size={13} />}
              label="Désactiver sync"
              onClick={() => bulkAction('disable_sync')}
              loading={bulkLoading}
            />

            {/* Annuler */}
            <BulkBtn
              icon={<XCircle size={13} />}
              label="Annuler"
              onClick={() => bulkAction('cancel')}
              loading={bulkLoading}
              color={colors.red}
            />

            {/* Error */}
            {bulkError && (
              <span style={{ fontSize: 12, color: colors.red, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> {bulkError}
              </span>
            )}

            {/* Clear */}
            <button
              onClick={clearSelection}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', color: colors.textLt, display: 'flex', alignItems: 'center', padding: 4,
              }}
              title="Annuler la sélection"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', border: `1px solid ${colors.border}`,
          borderRadius: 6, overflow: 'auto', flex: 1,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                <TH width={36}>
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleSelectAll} />
                </TH>
                <TH width={110}>Référence</TH>
                <TH width={115}>Téléphone</TH>
                <TH width={150}>Client</TH>
                <TH width={95}>Wilaya</TH>
                <TH width={100}>Expédiée le</TH>
                <TH width={130}>Livreur</TH>
                <TH width={130}>Statut livraison</TH>
                <TH width={56} center>Sync</TH>
                <TH width={72}>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={COLS} />)
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={COLS} style={{
                    textAlign: 'center', padding: '40px 12px',
                    color: colors.textLt, fontSize: 13,
                  }}>
                    <Package size={28} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    Aucune commande en livraison
                  </td>
                </tr>
              ) : (
                orders.map(order => {
                  const isSelected = selectedIds.has(order.id)
                  const delivSlug  = order.delivery_status
                  const delivName  = delivSlug ? (delivStatusMap.get(delivSlug) ?? delivSlug) : null
                  const delivColor = delivSlug ? (DELIV_COLORS[delivSlug] ?? { color: '#546E7A', bg: '#ECEFF1' }) : null

                  return (
                    <tr
                      key={order.id}
                      onClick={() => setDrawerOrderId(order.id)}
                      style={{
                        background: isSelected ? colors.primaryLt : undefined,
                        cursor: 'pointer', transition: 'background .1s',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = '#fafafa'
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = ''
                      }}
                    >
                      {/* Checkbox */}
                      <TD>
                        <span onClick={e => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onChange={() => toggleSelect(order.id)} />
                        </span>
                      </TD>

                      {/* Reference */}
                      <TD>
                        <span style={{ fontWeight: 600, color: colors.primary, fontSize: 12 }}>
                          {order.reference}
                        </span>
                      </TD>

                      {/* Phone */}
                      <TD muted>{order.client_phone ?? order.phone}</TD>

                      {/* Client */}
                      <TD>
                        {order.client_name
                          ? <span style={{ fontWeight: 500 }}>{order.client_name}</span>
                          : <span style={{ color: colors.textLt }}>—</span>
                        }
                      </TD>

                      {/* Wilaya */}
                      <TD muted>{order.wilaya_name ?? '—'}</TD>

                      {/* Shipped at */}
                      <TD muted>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={11} style={{ color: colors.textLt }} />
                          {fmtDate(order.shipped_at)}
                        </span>
                      </TD>

                      {/* Carrier */}
                      <TD>
                        {order.carrier_name
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <Truck size={11} style={{ color: colors.textLt, flexShrink: 0 }} />
                              <span style={{ fontWeight: 500 }}>{order.carrier_name}</span>
                            </span>
                          : <span style={{ color: colors.textLt, fontSize: 11.5 }}>—</span>
                        }
                      </TD>

                      {/* Delivery status badge */}
                      <td style={{
                        padding: '8px 10px', borderBottom: `1px solid ${colors.border}`,
                        verticalAlign: 'middle',
                      }}>
                        {delivName && delivColor ? (
                          <span style={{
                            display: 'inline-block',
                            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                            color: delivColor.color, background: delivColor.bg, whiteSpace: 'nowrap',
                          }}>
                            {delivName}
                          </span>
                        ) : (
                          <span style={{ color: colors.textLt, fontSize: 11.5 }}>—</span>
                        )}
                      </td>

                      {/* Sync */}
                      <td style={{
                        padding: '8px 10px', textAlign: 'center',
                        borderBottom: `1px solid ${colors.border}`, verticalAlign: 'middle',
                      }}>
                        <span title={order.sync_enabled ? 'Sync actif' : 'Sync désactivé'}>
                          {order.sync_enabled
                            ? <Wifi    size={14} style={{ color: colors.green }} />
                            : <WifiOff size={14} style={{ color: colors.textLt }} />
                          }
                        </span>
                      </td>

                      {/* Actions */}
                      <td
                        style={{
                          padding: '8px 10px', borderBottom: `1px solid ${colors.border}`,
                          verticalAlign: 'middle',
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', gap: 4 }}>
                          <ActionBtn
                            icon={<Eye size={12} />}
                            title="Voir"
                            onClick={() => setDrawerOrderId(order.id)}
                          />
                          <ActionBtn
                            icon={<Pencil size={12} />}
                            title="Modifier"
                            onClick={() => router.push(`/dashboard/orders/${order.id}/edit`)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {total > LIMIT && (
          <Pagination
            page={page}
            total={total}
            limit={LIMIT}
            onChange={p => { setPage(p); setSelectedIds(new Set()) }}
          />
        )}
      </div>

      {/* ── Detail panel ────────────────────────────────────────────────────── */}
      <OrderDetailPanel
        orderId={drawerOrderId}
        onClose={() => setDrawerOrderId(null)}
        onStatusChange={fetchOrders}
      />
    </>
  )
}

// ── Tiny helpers ───────────────────────────────────────────────────────────────

function ActionBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 26, height: 26, borderRadius: 4,
        border: `1px solid ${colors.border}`, background: '#fff',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: colors.textMd,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background   = colors.primaryLt
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.primary
        ;(e.currentTarget as HTMLButtonElement).style.color       = colors.primary
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background   = '#fff'
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.border
        ;(e.currentTarget as HTMLButtonElement).style.color       = colors.textMd
      }}
    >
      {icon}
    </button>
  )
}

function BulkBtn({
  icon, label, onClick, loading, color,
}: {
  icon:     React.ReactNode
  label:    string
  onClick:  () => void
  loading?: boolean
  color?:   string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 4, fontSize: 12,
        border: `1px solid ${colors.border}`, background: '#fff',
        color: color ?? colors.text, cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1, fontFamily: fonts.sans, fontWeight: 500,
      }}
      onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5' }}
      onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
    >
      {icon}{label}
    </button>
  )
}
