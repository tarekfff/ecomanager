'use client'

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { X, AlertCircle, Package } from 'lucide-react'
import { PageHeader, Button, SearchInput, Pagination } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'
import { useBoutique } from '@/contexts/BoutiqueContext'
import OrderDetailPanel from '@/components/orders/OrderDetailPanel'

// ── Public types ───────────────────────────────────────────────────────────────

export interface OrderRow {
  id:                  string
  reference:           string
  tracking_status:     string
  confirmation_status: string | null
  delivery_status:     string | null
  total:               number
  carrier_fee:         number
  phone:               string
  client_name:         string | null
  client_phone:        string | null
  wilaya_name:         string | null
  carrier_name:        string | null
  confirmer_name:      string | null
  created_at:          string
  confirmed_at:        string | null
  dispatched_at:       string | null
  shipped_at:          string | null
  delivered_at:        string | null
  updated_at:          string | null
  cancelled_at:        string | null
  deleted_at:          string | null
  sync_enabled:        boolean
  items_count:         number
}

export interface RenderCtx {
  refresh:    () => void
  openDetail: (id: string) => void
  auth:       () => { Authorization: string }
}

export interface ColDef {
  key:      string
  label:    string
  width?:   number
  center?:  boolean
  render:   (row: OrderRow, ctx: RenderCtx) => ReactNode
}

export interface BulkActionDef {
  id:          string
  label:       string
  icon:        ReactNode
  color?:      string
  dangerous?:  boolean  // triggers window.confirm before executing
}

export interface OrdersPageProps {
  title:             string
  emptyText?:        string
  status:            string   // 'corbeille' = deleted orders
  columns:           ColDef[]
  bulkActions:       BulkActionDef[]
  showCarrierFilter?: boolean
  showDateFilter?:   boolean
  newOrderButton?:   boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function auth(): { Authorization: string } {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function fmtTotal(n: number) {
  return n.toLocaleString('fr-DZ') + ' DA'
}

// ── Inner primitives ───────────────────────────────────────────────────────────

function Checkbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate }, [indeterminate])
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={onChange}
      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: colors.primary }} />
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

function BulkBtn({ icon, label, onClick, loading, color }: {
  icon: ReactNode; label: string; onClick: () => void; loading?: boolean; color?: string
}) {
  return (
    <button onClick={onClick} disabled={loading} style={{
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

// ── Main component ─────────────────────────────────────────────────────────────

export default function OrdersPage({
  title,
  emptyText = 'Aucune commande',
  status,
  columns,
  bulkActions,
  showCarrierFilter = false,
  showDateFilter    = true,
  newOrderButton    = true,
}: OrdersPageProps) {
  const router         = useRouter()
  const { boutiqueId } = useBoutique()

  const [orders,  setOrders]  = useState<OrderRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [page,    setPage]    = useState(1)
  const [loading, setLoading] = useState(false)

  const [search,   setSearch]   = useState('')
  const [dbSearch, setDbSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError,   setBulkError]   = useState('')

  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchOrders = useCallback(() => {
    if (!boutiqueId) return
    setLoading(true)
    const qs = new URLSearchParams({
      status,
      boutique_id: boutiqueId,
      page:        String(page),
      limit:       '25',
      search:      dbSearch,
    })
    if (dateFrom) qs.set('date_from', dateFrom)
    if (dateTo)   qs.set('date_to',   dateTo)

    fetch(`/api/orders?${qs}`, { headers: auth() })
      .then(r => r.json())
      .then(d => { setOrders(d.items ?? []); setTotal(d.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boutiqueId, status, page, dbSearch, dateFrom, dateTo])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ── Search debounce ───────────────────────────────────────────────────────

  function handleSearch(val: string) {
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

  function toggleAll() {
    if (selectedIds.size === orders.length && orders.length > 0) setSelectedIds(new Set())
    else setSelectedIds(new Set(orders.map(o => o.id)))
  }

  function clearSelection() { setSelectedIds(new Set()); setBulkError('') }

  // ── Bulk ──────────────────────────────────────────────────────────────────

  async function doBulk(actionId: string, def: BulkActionDef) {
    if (selectedIds.size === 0) return
    if (def.dangerous && !window.confirm(`${def.label} — cette action est irréversible. Continuer ?`)) return
    setBulkLoading(true)
    setBulkError('')
    try {
      const res = await fetch('/api/orders/bulk', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body:    JSON.stringify({ ids: Array.from(selectedIds), action: actionId }),
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
  const COLS         = columns.length + 1  // +1 for checkbox

  const renderCtx: RenderCtx = {
    refresh:    fetchOrders,
    openDetail: (id) => setDrawerOrderId(id),
    auth,
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title={title}
        subtitle={total > 0 ? `${total} résultat${total !== 1 ? 's' : ''}` : undefined}
        actions={newOrderButton ? (
          <Button variant="primary" size="sm" onClick={() => router.push('/dashboard/orders/new')}>
            + Nouvelle commande
          </Button>
        ) : undefined}
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

        {/* ── Filter bar ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', maxWidth: 260 }}>
            <SearchInput value={search} onChange={handleSearch} placeholder="Réf., téléphone, client…" />
          </div>

          {showDateFilter && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 12, color: colors.textMd, whiteSpace: 'nowrap' }}>De</label>
                <input type="date" value={dateFrom}
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
                <input type="date" value={dateTo}
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
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
                  style={{ fontSize: 12, color: colors.textLt, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Effacer
                </button>
              )}
            </>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 12, color: colors.textMd, whiteSpace: 'nowrap' }}>
            {loading ? '…' : `${total} résultat${total !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* ── Bulk bar ─────────────────────────────────────────────────── */}
        {nSelected > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            background: colors.primaryLt, border: `1px solid ${colors.primary}33`,
            borderRadius: 6, padding: '8px 12px',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: colors.primary, marginRight: 4 }}>
              {nSelected} sélectionné{nSelected > 1 ? 's' : ''}
            </span>

            {bulkActions.map(def => (
              <BulkBtn
                key={def.id}
                icon={def.icon}
                label={def.label}
                color={def.color}
                loading={bulkLoading}
                onClick={() => doBulk(def.id, def)}
              />
            ))}

            {bulkError && (
              <span style={{ fontSize: 12, color: colors.red, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> {bulkError}
              </span>
            )}

            <button onClick={clearSelection} style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', color: colors.textLt, display: 'flex', alignItems: 'center', padding: 4,
            }} title="Annuler la sélection">
              <X size={15} />
            </button>
          </div>
        )}

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 6, overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                <th style={{ width: 36, padding: '8px 10px', background: '#f5f5f5' }}>
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
                </th>
                {columns.map(col => (
                  <th key={col.key} style={{
                    fontSize: 11.5, fontWeight: 600, color: colors.textMd,
                    padding: '8px 10px', textAlign: col.center ? 'center' : 'left',
                    whiteSpace: 'nowrap', width: col.width, background: '#f5f5f5',
                  }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={COLS} />)
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={COLS} style={{ textAlign: 'center', padding: '40px 12px', color: colors.textLt, fontSize: 13 }}>
                    <Package size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                    {emptyText}
                  </td>
                </tr>
              ) : (
                orders.map(row => {
                  const isSelected = selectedIds.has(row.id)
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setDrawerOrderId(row.id)}
                      style={{ background: isSelected ? colors.primaryLt : undefined, cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = '#fafafa' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                    >
                      <td style={{ padding: '8px 10px', borderBottom: `1px solid ${colors.border}`, verticalAlign: 'middle' }}>
                        <span onClick={e => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onChange={() => toggleSelect(row.id)} />
                        </span>
                      </td>
                      {columns.map(col => (
                        <td
                          key={col.key}
                          style={{
                            fontSize: 12.5, padding: '8px 10px',
                            color: colors.text,
                            borderBottom: `1px solid ${colors.border}`,
                            textAlign: col.center ? 'center' : 'left',
                            verticalAlign: 'middle',
                          }}
                          onClick={col.key === 'actions' ? e => e.stopPropagation() : undefined}
                        >
                          {col.render(row, renderCtx)}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 25 && (
          <Pagination page={page} total={total} limit={25} onChange={p => { setPage(p); setSelectedIds(new Set()) }} />
        )}
      </div>

      <OrderDetailPanel
        orderId={drawerOrderId}
        onClose={() => setDrawerOrderId(null)}
        onStatusChange={fetchOrders}
      />
    </>
  )
}

// ── Exported cell helpers (archive pages use these) ────────────────────────────

export function CellRef({ reference }: { reference: string }) {
  return <span style={{ fontWeight: 600, color: colors.primary, fontSize: 12 }}>{reference}</span>
}

export function CellClient({ name }: { name: string | null }) {
  return name
    ? <span style={{ fontWeight: 500 }}>{name}</span>
    : <span style={{ color: colors.textLt }}>—</span>
}

export function CellMuted({ value }: { value: string | null | undefined }) {
  return <span style={{ color: colors.textMd }}>{value ?? '—'}</span>
}

export function CellDate({ iso }: { iso: string | null }) {
  const label = iso
    ? new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : '—'
  return <span style={{ color: colors.textMd }}>{label}</span>
}

export function CellTotal({ amount }: { amount: number }) {
  return <span style={{ fontWeight: 600 }}>{fmtTotal(amount)}</span>
}

export function CellStatus({ slug }: { slug: string }) {
  const MAP: Record<string, { label: string; color: string; bg: string }> = {
    en_confirmation: { label: 'En confirmation', color: '#1565C0', bg: '#E3F2FD' },
    en_preparation:  { label: 'En préparation',  color: '#6A1B9A', bg: '#F3E5F5' },
    en_dispatch:     { label: 'En dispatch',     color: '#E65100', bg: '#FFF3E0' },
    en_livraison:    { label: 'En livraison',    color: '#37474F', bg: '#ECEFF1' },
    livree:          { label: 'Livrée',          color: '#1B5E20', bg: '#E8F5E9' },
    en_retour:       { label: 'En retour',       color: '#B71C1C', bg: '#FFEBEE' },
    retournee:       { label: 'Retournée',       color: '#880E4F', bg: '#FCE4EC' },
    encaissee:       { label: 'Encaissée',       color: '#004D40', bg: '#E0F2F1' },
    annulee:         { label: 'Annulée',         color: '#616161', bg: '#F5F5F5' },
  }
  const cfg = MAP[slug]
  if (!cfg) return <span style={{ color: colors.textMd, fontSize: 11.5 }}>{slug}</span>
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700,
      padding: '2px 8px', borderRadius: 10,
      color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

export function ActionBtn({ icon, title, onClick, color }: {
  icon: React.ReactNode; title: string; onClick: (e: React.MouseEvent) => void; color?: string
}) {
  return (
    <button title={title} onClick={onClick} style={{
      width: 26, height: 26, borderRadius: 4,
      border: `1px solid ${colors.border}`, background: '#fff',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: color ?? colors.textMd,
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background   = colors.primaryLt
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.primary
        ;(e.currentTarget as HTMLButtonElement).style.color       = color ?? colors.primary
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background   = '#fff'
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.border
        ;(e.currentTarget as HTMLButtonElement).style.color       = color ?? colors.textMd
      }}
    >
      {icon}
    </button>
  )
}
