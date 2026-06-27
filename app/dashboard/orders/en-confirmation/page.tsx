'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye, Pencil, X, ChevronDown, AlertCircle,
  CheckCircle, XCircle, Trash2, UserCheck, Tag,
  Package, User, Calendar,
} from 'lucide-react'
import { PageHeader, Button, SearchInput, Select, Pagination } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'
import { useBoutique } from '@/contexts/BoutiqueContext'
import OrderDetailPanel from '@/components/orders/OrderDetailPanel'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Order {
  id:                    string
  reference:             string
  tracking_status:       string
  confirmation_status:   string | null
  total:                 number
  subtotal:              number
  delivery_fee:          number
  discount:              number
  delivery_method:       string
  return_risk_score:     number | null
  assigned_confirmer_id: string | null
  created_at:            string
  phone:                 string
  client_name:           string | null
  client_phone:          string | null
  wilaya_name:           string | null
  commune_name:          string | null
  confirmer_name:        string | null
  items_count:           number
}

interface AppUser { id: string; name: string; email: string }

// ── Constants ──────────────────────────────────────────────────────────────────

const LIMIT = 25

const CONF_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  echec_1:            { label: 'Échec 1',       color: '#E65100', bg: '#FFF3E0' },
  echec_2:            { label: 'Échec 2',       color: '#D84315', bg: '#FBE9E7' },
  echec_3:            { label: 'Échec 3',       color: '#B71C1C', bg: '#FFEBEE' },
  suspendue:          { label: 'Suspendue',     color: '#546E7A', bg: '#ECEFF1' },
  annulation_demande: { label: 'Ann. demandée', color: '#C62828', bg: '#FFEBEE' },
}

const CONF_STATUS_OPTIONS = Object.entries(CONF_STATUS).map(([value, { label }]) => ({ value, label }))

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-DZ', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

function fmtAmount(n: number) {
  return n.toLocaleString('fr-DZ') + ' DA'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConfStatusBadge({ slug }: { slug: string | null }) {
  if (!slug) return <span style={{ color: colors.textLt, fontSize: 11 }}>—</span>
  const cfg = CONF_STATUS[slug]
  if (!cfg) return <span style={{ fontSize: 11, color: colors.textMd }}>{slug}</span>
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
      color: cfg.color, background: cfg.bg, display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function RiskBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span style={{ color: colors.textLt, fontSize: 11 }}>—</span>
  }
  const pct = score <= 1 ? Math.round(score * 100) : Math.round(score)
  const color = pct < 20 ? colors.green : pct < 50 ? colors.orange : colors.red
  return <span style={{ fontSize: 12, fontWeight: 600, color }}>{pct}%</span>
}

function Checkbox({
  checked, indeterminate, onChange,
}: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: colors.primary }}
    />
  )
}

// ── Skeleton row ───────────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '9px 10px', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{
            height: 12, borderRadius: 3, background: '#ececec',
            width: i === 0 ? 14 : `${55 + (i % 3) * 20}%`,
          }} />
        </td>
      ))}
    </tr>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EnConfirmationPage() {
  const router         = useRouter()
  const { boutiqueId } = useBoutique()

  // List state
  const [orders,   setOrders]   = useState<Order[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(false)

  // Search + filters
  const [search,    setSearch]    = useState('')
  const [dbSearch,  setDbSearch]  = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')

  // Users for filter / assignment
  const [users, setUsers] = useState<AppUser[]>([])

  // Selection
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set())
  const [bulkLoading,  setBulkLoading]  = useState(false)
  const [bulkError,    setBulkError]    = useState('')

  // Bulk dropdown menus
  const [showAssignMenu,  setShowAssignMenu]  = useState(false)
  const [showStatusMenu,  setShowStatusMenu]  = useState(false)
  const assignMenuRef  = useRef<HTMLDivElement>(null)
  const statusMenuRef  = useRef<HTMLDivElement>(null)

  // Drawer — stores order ID only; OrderDetailPanel fetches its own data
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null)

  // Live refresh — banner when new orders arrive
  const [newCount,     setNewCount]     = useState(0)
  const knownTotalRef  = useRef<number | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Close menus on outside click ─────────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (assignMenuRef.current && !assignMenuRef.current.contains(e.target as Node)) {
        setShowAssignMenu(false)
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Load users once ───────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/users', { headers: authHeader() })
      .then(r => r.json())
      .then((d: AppUser[]) => { if (Array.isArray(d)) setUsers(d) })
      .catch(() => {})
  }, [])

  // ── Fetch orders ──────────────────────────────────────────────────────────

  const fetchOrders = useCallback(() => {
    if (!boutiqueId) return
    setLoading(true)
    const qs = new URLSearchParams({
      status:       'en_confirmation',
      boutique_id:  boutiqueId,
      page:         String(page),
      limit:        String(LIMIT),
      search:       dbSearch,
    })
    if (filterUser) qs.set('assigned_to', filterUser)
    if (dateFrom)   qs.set('date_from', dateFrom)
    if (dateTo)     qs.set('date_to', dateTo)

    fetch(`/api/orders?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => {
        setOrders(d.items ?? [])
        setTotal(d.total ?? 0)
        knownTotalRef.current = d.total ?? 0
        setNewCount(0)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boutiqueId, page, dbSearch, filterUser, dateFrom, dateTo])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ── Background poll — detect new orders every 10s ──────────────────────────
  // If the user is idle on page 1 (no selection, no search), auto-refresh the
  // list so new synced orders appear without a click. Otherwise just flag the
  // banner so we don't yank the table while they're working.
  useEffect(() => {
    if (!boutiqueId) return
    const check = () => {
      if (document.hidden) return  // skip polling on background tabs
      const qs = new URLSearchParams({ status: 'en_confirmation', boutique_id: boutiqueId, page: '1', limit: '1' })
      fetch(`/api/orders?${qs}`, { headers: authHeader() })
        .then(r => r.json())
        .then(d => {
          const t = d.total ?? 0
          if (knownTotalRef.current === null) { knownTotalRef.current = t; return }
          if (t > knownTotalRef.current) {
            const idle = page === 1 && selectedIds.size === 0 && !dbSearch
            if (idle) fetchOrders()              // seamless auto-refresh
            else setNewCount(t - knownTotalRef.current)  // show banner instead
          }
        })
        .catch(() => {})
    }
    const id = setInterval(check, 10_000)
    return () => clearInterval(id)
  }, [boutiqueId, page, selectedIds, dbSearch, fetchOrders])

  // ── Search debounce ───────────────────────────────────────────────────────

  function handleSearchChange(val: string) {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDbSearch(val); setPage(1) }, 300)
  }

  function handleFilterChange(setter: (v: string) => void) {
    return (val: string) => { setter(val); setPage(1) }
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === orders.length && orders.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)))
    }
  }

  function clearSelection() { setSelectedIds(new Set()); setBulkError('') }

  // ── Bulk actions ──────────────────────────────────────────────────────────

  async function bulkAction(action: string, value?: string) {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    setBulkError('')
    try {
      const res = await fetch('/api/orders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ ids: Array.from(selectedIds), action, value }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setBulkError(data.error ?? 'Erreur'); return }
      setSelectedIds(new Set())
      fetchOrders()
    } finally {
      setBulkLoading(false)
      setShowAssignMenu(false)
      setShowStatusMenu(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const allSelected  = orders.length > 0 && selectedIds.size === orders.length
  const someSelected = selectedIds.size > 0 && !allSelected
  const nSelected    = selectedIds.size

  const userOptions = [
    { value: '', label: 'Tous les confirmateurs' },
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]

  // ── Table header cell ─────────────────────────────────────────────────────

  const TH = ({ children, width, center }: { children: React.ReactNode; width?: number; center?: boolean }) => (
    <th style={{
      fontSize: 11.5, fontWeight: 600, color: colors.textMd,
      padding: '8px 10px', textAlign: center ? 'center' : 'left',
      whiteSpace: 'nowrap', width, background: '#f5f5f5',
    }}>
      {children}
    </th>
  )

  // ── Table data cell ───────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="En confirmation"
        subtitle={
          total > 0
            ? `${total} commande${total > 1 ? 's' : ''} en attente de confirmation`
            : 'Commandes en attente de confirmation'
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

        {/* ── New orders banner ──────────────────────────────────────────── */}
        {newCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#F0FDF4', border: '1px solid #86EFAC',
            borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#166534',
            cursor: 'pointer',
          }}
            onClick={() => { setNewCount(0); knownTotalRef.current = null; fetchOrders() }}
          >
            <span style={{
              background: '#22C55E', color: '#fff', borderRadius: '50%',
              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>{newCount}</span>
            <span>
              <strong>{newCount} nouvelle{newCount > 1 ? 's' : ''} commande{newCount > 1 ? 's' : ''}</strong> reçue{newCount > 1 ? 's' : ''} — Cliquez pour actualiser
            </span>
          </div>
        )}

        {/* No boutique warning */}
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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <div style={{ flex: '1 1 200px', maxWidth: 260 }}>
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Réf., téléphone, client…"
            />
          </div>

          <div style={{ width: 190 }}>
            <Select
              value={filterUser}
              onChange={handleFilterChange(setFilterUser)}
              options={userOptions}
              placeholder="Tous les confirmateurs"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: colors.textMd, whiteSpace: 'nowrap' }}>De</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              style={{
                border: `1px solid ${colors.border}`, borderRadius: 4,
                padding: '6px 8px', fontSize: 12.5, fontFamily: fonts.sans,
                color: dateFrom ? colors.text : colors.textLt, outline: 'none',
                background: '#fff',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
              onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: colors.textMd }}>À</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
              style={{
                border: `1px solid ${colors.border}`, borderRadius: 4,
                padding: '6px 8px', fontSize: 12.5, fontFamily: fonts.sans,
                color: dateTo ? colors.text : colors.textLt, outline: 'none',
                background: '#fff',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
              onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
            />
          </div>

          {(dateFrom || dateTo || filterUser) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setFilterUser(''); setPage(1) }}
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

            {/* Confirmer */}
            <BulkBtn
              icon={<CheckCircle size={13} />}
              label="Confirmer"
              onClick={() => bulkAction('confirm')}
              loading={bulkLoading}
              color={colors.green}
            />

            {/* Annuler */}
            <BulkBtn
              icon={<XCircle size={13} />}
              label="Annuler"
              onClick={() => bulkAction('cancel')}
              loading={bulkLoading}
              color={colors.red}
            />

            {/* Supprimer */}
            <BulkBtn
              icon={<Trash2 size={13} />}
              label="Supprimer"
              onClick={() => bulkAction('delete')}
              loading={bulkLoading}
              color={colors.textMd}
            />

            {/* Affecter à */}
            <div ref={assignMenuRef} style={{ position: 'relative' }}>
              <BulkBtn
                icon={<UserCheck size={13} />}
                label="Affecter à"
                suffix={<ChevronDown size={11} />}
                onClick={() => { setShowAssignMenu(v => !v); setShowStatusMenu(false) }}
                loading={bulkLoading}
              />
              {showAssignMenu && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
                  background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 6,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 180, maxHeight: 220, overflowY: 'auto',
                }}>
                  {users.length === 0 && (
                    <div style={{ padding: '10px 14px', fontSize: 12.5, color: colors.textLt }}>
                      Aucun utilisateur
                    </div>
                  )}
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => bulkAction('assign', u.id)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 14px', fontSize: 12.5, fontFamily: fonts.sans,
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        color: colors.text,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = colors.primaryLt)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modifier statut confirmation */}
            <div ref={statusMenuRef} style={{ position: 'relative' }}>
              <BulkBtn
                icon={<Tag size={13} />}
                label="Statut conf."
                suffix={<ChevronDown size={11} />}
                onClick={() => { setShowStatusMenu(v => !v); setShowAssignMenu(false) }}
                loading={bulkLoading}
              />
              {showStatusMenu && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50,
                  background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 6,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 160, overflow: 'hidden',
                }}>
                  {CONF_STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => bulkAction('set_confirmation_status', opt.value)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 14px', fontSize: 12.5, fontFamily: fonts.sans,
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        color: CONF_STATUS[opt.value].color,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = CONF_STATUS[opt.value].bg)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bulk error */}
            {bulkError && (
              <span style={{ fontSize: 12, color: colors.red, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> {bulkError}
              </span>
            )}

            {/* Clear selection */}
            <button
              onClick={clearSelection}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', color: colors.textLt, display: 'flex', alignItems: 'center',
                padding: 4,
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                <TH width={36}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleSelectAll}
                  />
                </TH>
                <TH width={110}>Référence</TH>
                <TH width={110}>Statut conf.</TH>
                <TH width={110}>Téléphone</TH>
                <TH width={150}>Client</TH>
                <TH width={95}>Wilaya</TH>
                <TH width={95}>Commune</TH>
                <TH width={65} center>Risque</TH>
                <TH width={60} center>Articles</TH>
                <TH width={105}>Total</TH>
                <TH width={90}>Créée le</TH>
                <TH width={120}>Affectée à</TH>
                <TH width={72}>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={13} />)
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{
                    textAlign: 'center', padding: '40px 12px',
                    color: colors.textLt, fontSize: 13,
                  }}>
                    <Package size={28} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    Aucune commande en confirmation
                  </td>
                </tr>
              ) : (
                orders.map(order => {
                  const isSelected = selectedIds.has(order.id)
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setDrawerOrderId(order.id)}
                      style={{
                        background: isSelected ? colors.primaryLt : undefined,
                        cursor: 'pointer', transition: 'background .1s',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected)
                          (e.currentTarget as HTMLTableRowElement).style.background = '#fafafa'
                      }}
                      onMouseLeave={e => {
                        if (!isSelected)
                          (e.currentTarget as HTMLTableRowElement).style.background = ''
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

                      {/* Confirmation status */}
                      <TD><ConfStatusBadge slug={order.confirmation_status} /></TD>

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

                      {/* Commune */}
                      <TD muted>{order.commune_name ?? '—'}</TD>

                      {/* Risk */}
                      <td style={{
                        padding: '8px 10px', textAlign: 'center',
                        borderBottom: `1px solid ${colors.border}`, verticalAlign: 'middle',
                      }}>
                        <RiskBadge score={order.return_risk_score} />
                      </td>

                      {/* Items count */}
                      <td style={{
                        padding: '8px 10px', textAlign: 'center',
                        borderBottom: `1px solid ${colors.border}`, verticalAlign: 'middle',
                        fontSize: 12.5, color: colors.textMd,
                      }}>
                        {order.items_count}
                      </td>

                      {/* Total */}
                      <TD>
                        <span style={{ fontWeight: 600, color: colors.text }}>
                          {fmtAmount(order.total)}
                        </span>
                      </TD>

                      {/* Created at */}
                      <TD muted>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={11} style={{ color: colors.textLt }} />
                          {fmtDate(order.created_at)}
                        </span>
                      </TD>

                      {/* Confirmer */}
                      <TD muted>
                        {order.confirmer_name
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <User size={11} style={{ color: colors.textLt }} />
                              {order.confirmer_name}
                            </span>
                          : <span style={{ color: colors.textLt }}>—</span>
                        }
                      </TD>

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

function ActionBtn({
  icon, title, onClick,
}: { icon: React.ReactNode; title: string; onClick: () => void }) {
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
        (e.currentTarget as HTMLButtonElement).style.background = colors.primaryLt
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.primary
        ;(e.currentTarget as HTMLButtonElement).style.color = colors.primary
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = '#fff'
        ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.border
        ;(e.currentTarget as HTMLButtonElement).style.color = colors.textMd
      }}
    >
      {icon}
    </button>
  )
}

function BulkBtn({
  icon, label, suffix, onClick, loading, color,
}: {
  icon: React.ReactNode
  label: string
  suffix?: React.ReactNode
  onClick: () => void
  loading?: boolean
  color?: string
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
      {icon}{label}{suffix}
    </button>
  )
}
