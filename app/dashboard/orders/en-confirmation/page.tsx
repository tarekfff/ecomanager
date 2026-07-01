'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
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

const CONF_STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  echec_1:            { color: '#E65100', bg: '#FFF3E0' },
  echec_2:            { color: '#D84315', bg: '#FBE9E7' },
  echec_3:            { color: '#B71C1C', bg: '#FFEBEE' },
  suspendue:          { color: '#546E7A', bg: '#ECEFF1' },
  annulation_demande: { color: '#C62828', bg: '#FFEBEE' },
}

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
  const { t } = useTranslation('orders')
  if (!slug) return <span style={{ color: colors.textLt, fontSize: 11 }}>—</span>
  const cfg = CONF_STATUS_COLORS[slug]
  if (!cfg) return <span style={{ fontSize: 11, color: colors.textMd }}>{slug}</span>
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
      color: cfg.color, background: cfg.bg, display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {t(`confStatusLabels.${slug}`, { defaultValue: slug })}
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

// ── Table cells ───────────────────────────────────────────────────────────────

function TH({ children, width, center }: { children: React.ReactNode; width?: number; center?: boolean }) {
  return (
    <th style={{
      fontSize: 11.5, fontWeight: 600, color: colors.textMd,
      padding: '8px 10px', textAlign: center ? 'center' : 'left',
      whiteSpace: 'nowrap', width, background: '#f5f5f5',
    }}>
      {children}
    </th>
  )
}

function TD({ children, center, muted }: { children: React.ReactNode; center?: boolean; muted?: boolean }) {
  return (
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
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EnConfirmationPage() {
  const router         = useRouter()
  const { boutiqueId } = useBoutique()
  const { t }          = useTranslation('orders')

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

  // Drawer
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null)

  // Live refresh
  const [newCount,     setNewCount]     = useState(0)
  const [newOrderIds,  setNewOrderIds]  = useState<Set<string>>(new Set())
  const cursorRef      = useRef<string | null>(null)
  const liveStateRef   = useRef({ page, selectedIds, dbSearch, filterUser, dateFrom, dateTo })

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Translated conf-status options (built inside component so labels re-render on lang change)
  const CONF_STATUS_OPTIONS = Object.entries(CONF_STATUS_COLORS).map(([value, cfg]) => ({
    value,
    label: t(`confStatusLabels.${value}`, { defaultValue: value }),
    ...cfg,
  }))

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
        const items: Order[] = d.items ?? []
        setOrders(items)
        setTotal(d.total ?? 0)
        if (page === 1) cursorRef.current = items[0]?.created_at ?? new Date().toISOString()
        setNewCount(0)
        setNewOrderIds(new Set())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boutiqueId, page, dbSearch, filterUser, dateFrom, dateTo])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  liveStateRef.current = { page, selectedIds, dbSearch, filterUser, dateFrom, dateTo }

  // ── Sheet sync ────────────────────────────────────────────────────────────
  const lastSyncRef = useRef(0)
  const triggerSync = useCallback(() => {
    if (!boutiqueId) return
    if (Date.now() - lastSyncRef.current < 5_000) return
    lastSyncRef.current = Date.now()
    fetch(`/api/import-sources/poll?boutique_id=${boutiqueId}`, { method: 'POST', headers: authHeader() })
      .then(r => r.json())
      .then(d => { if ((d.imported ?? 0) > 0) fetchOrders() })
      .catch(() => {})
  }, [boutiqueId, fetchOrders])

  useEffect(() => { triggerSync() }, [triggerSync])

  // ── Live stream ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!boutiqueId) return
    let lastPeriodicSync = 0

    const tick = () => {
      if (document.hidden) return

      if (Date.now() - lastPeriodicSync > 30_000) {
        lastPeriodicSync = Date.now()
        lastSyncRef.current = lastPeriodicSync
        fetch(`/api/import-sources/poll?boutique_id=${boutiqueId}`, { method: 'POST', headers: authHeader() })
          .catch(() => {})
      }

      if (!cursorRef.current) return
      const ls = liveStateRef.current
      const qs = new URLSearchParams({
        status: 'en_confirmation', boutique_id: boutiqueId,
        created_after: cursorRef.current, limit: '50', page: '1',
      })
      if (ls.filterUser) qs.set('assigned_to', ls.filterUser)

      fetch(`/api/orders?${qs}`, { headers: authHeader() })
        .then(r => r.json())
        .then(d => {
          const fresh: Order[] = d.items ?? []
          if (!fresh.length) return
          cursorRef.current = fresh[0].created_at

          const idle = ls.page === 1 && ls.selectedIds.size === 0
            && !ls.dbSearch && !ls.filterUser && !ls.dateFrom && !ls.dateTo

          if (idle) {
            setOrders(prev => [...fresh, ...prev])
            setTotal(t => t + fresh.length)
            setNewOrderIds(new Set(fresh.map(o => o.id)))
            setTimeout(() => setNewOrderIds(new Set()), 4000)
          } else {
            setNewCount(c => c + fresh.length)
          }
        })
        .catch(() => {})
    }
    const id = setInterval(tick, 8_000)

    const onVisible = () => { if (!document.hidden) { triggerSync(); tick() } }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [boutiqueId, triggerSync])

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
    { value: '', label: t('filters.allConfirmers') },
    ...users.map(u => ({ value: u.id, label: u.name })),
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title={t('enConfirmation.title')}
        subtitle={
          total > 0
            ? t('enConfirmation.subtitleN', { count: total })
            : t('enConfirmation.subtitleDefault')
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => router.push('/dashboard/orders/new')}>
            {t('newOrder')}
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
            onClick={() => { setNewCount(0); if (page !== 1) setPage(1); else fetchOrders() }}
          >
            <span style={{
              background: '#22C55E', color: '#fff', borderRadius: '50%',
              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>{newCount}</span>
            <span>{t('newBanner', { count: newCount })}</span>
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
            {t('noBoutique')}
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
              placeholder={t('filters.searchPh')}
            />
          </div>

          <div style={{ width: 190 }}>
            <Select
              value={filterUser}
              onChange={handleFilterChange(setFilterUser)}
              options={userOptions}
              placeholder={t('filters.allConfirmers')}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: colors.textMd, whiteSpace: 'nowrap' }}>{t('filters.from')}</label>
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
            <label style={{ fontSize: 12, color: colors.textMd }}>{t('filters.to')}</label>
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
              {t('filters.clearFilters')}
            </button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 12, color: colors.textMd, whiteSpace: 'nowrap' }}>
            {loading ? '…' : t('filters.results', { count: total })}
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
              {t('bulk.selected', { count: nSelected })}
            </span>

            {/* Confirmer */}
            <BulkBtn
              icon={<CheckCircle size={13} />}
              label={t('bulk.confirm')}
              onClick={() => bulkAction('confirm')}
              loading={bulkLoading}
              color={colors.green}
            />

            {/* Annuler */}
            <BulkBtn
              icon={<XCircle size={13} />}
              label={t('bulk.cancel')}
              onClick={() => bulkAction('cancel')}
              loading={bulkLoading}
              color={colors.red}
            />

            {/* Supprimer */}
            <BulkBtn
              icon={<Trash2 size={13} />}
              label={t('bulk.delete')}
              onClick={() => bulkAction('delete')}
              loading={bulkLoading}
              color={colors.textMd}
            />

            {/* Affecter à */}
            <div ref={assignMenuRef} style={{ position: 'relative' }}>
              <BulkBtn
                icon={<UserCheck size={13} />}
                label={t('bulk.assignTo')}
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
                      {t('bulk.noUsers')}
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

            {/* Statut confirmation */}
            <div ref={statusMenuRef} style={{ position: 'relative' }}>
              <BulkBtn
                icon={<Tag size={13} />}
                label={t('bulk.confStatus')}
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
                        color: opt.color,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = opt.bg)}
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
              title={t('bulk.clearSelection')}
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
                <TH width={110}>{t('cols.reference')}</TH>
                <TH width={110}>{t('cols.confStatus')}</TH>
                <TH width={110}>{t('cols.phone')}</TH>
                <TH width={150}>{t('cols.client')}</TH>
                <TH width={95}>{t('cols.wilaya')}</TH>
                <TH width={95}>{t('cols.commune')}</TH>
                <TH width={65} center>{t('cols.risk')}</TH>
                <TH width={60} center>{t('cols.items')}</TH>
                <TH width={105}>{t('cols.total')}</TH>
                <TH width={90}>{t('cols.createdAt')}</TH>
                <TH width={120}>{t('cols.confirmer')}</TH>
                <TH width={72}>{t('cols.actions')}</TH>
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
                    {t('enConfirmation.empty')}
                  </td>
                </tr>
              ) : (
                orders.map(order => {
                  const isSelected = selectedIds.has(order.id)
                  const isNew      = newOrderIds.has(order.id)
                  const baseBg     = isSelected ? colors.primaryLt : isNew ? '#ECFDF3' : ''
                  return (
                    <tr
                      key={order.id}
                      onClick={() => setDrawerOrderId(order.id)}
                      style={{
                        background: baseBg || undefined,
                        boxShadow: isNew ? `inset 3px 0 0 ${colors.green}` : undefined,
                        cursor: 'pointer', transition: 'background .6s ease',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected)
                          (e.currentTarget as HTMLTableRowElement).style.background = '#fafafa'
                      }}
                      onMouseLeave={e => {
                        if (!isSelected)
                          (e.currentTarget as HTMLTableRowElement).style.background = baseBg
                      }}
                    >
                      <TD>
                        <span onClick={e => e.stopPropagation()}>
                          <Checkbox checked={isSelected} onChange={() => toggleSelect(order.id)} />
                        </span>
                      </TD>
                      <TD>
                        <span style={{ fontWeight: 600, color: colors.primary, fontSize: 12 }}>
                          {order.reference}
                        </span>
                      </TD>
                      <TD><ConfStatusBadge slug={order.confirmation_status} /></TD>
                      <TD muted>{order.client_phone ?? order.phone}</TD>
                      <TD>
                        {order.client_name
                          ? <span style={{ fontWeight: 500 }}>{order.client_name}</span>
                          : <span style={{ color: colors.textLt }}>—</span>
                        }
                      </TD>
                      <TD muted>{order.wilaya_name ?? '—'}</TD>
                      <TD muted>{order.commune_name ?? '—'}</TD>
                      <td style={{
                        padding: '8px 10px', textAlign: 'center',
                        borderBottom: `1px solid ${colors.border}`, verticalAlign: 'middle',
                      }}>
                        <RiskBadge score={order.return_risk_score} />
                      </td>
                      <td style={{
                        padding: '8px 10px', textAlign: 'center',
                        borderBottom: `1px solid ${colors.border}`, verticalAlign: 'middle',
                        fontSize: 12.5, color: colors.textMd,
                      }}>
                        {order.items_count}
                      </td>
                      <TD>
                        <span style={{ fontWeight: 600, color: colors.text }}>
                          {fmtAmount(order.total)}
                        </span>
                      </TD>
                      <TD muted>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={11} style={{ color: colors.textLt }} />
                          {fmtDate(order.created_at)}
                        </span>
                      </TD>
                      <TD muted>
                        {order.confirmer_name
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <User size={11} style={{ color: colors.textLt }} />
                              {order.confirmer_name}
                            </span>
                          : <span style={{ color: colors.textLt }}>—</span>
                        }
                      </TD>
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
                            title={t('actions.view')}
                            onClick={() => setDrawerOrderId(order.id)}
                          />
                          <ActionBtn
                            icon={<Pencil size={12} />}
                            title={t('actions.edit')}
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
