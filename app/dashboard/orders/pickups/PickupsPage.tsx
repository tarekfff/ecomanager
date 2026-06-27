'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Package, AlertCircle, RotateCcw, XCircle, X,
  Wifi, WifiOff, Check, Loader2,
} from 'lucide-react'
import { PageHeader, SearchInput, Pagination } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'
import { useBoutique } from '@/contexts/BoutiqueContext'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PickupRow {
  id:           string
  order_id:     string
  carrier_id:   string | null
  status:       string
  sync_enabled: boolean
  created_at:   string
  collected_at:  string | null
  received_at:   string | null
  processed_at:  string | null
  cancelled_at:  string | null
  reference:    string
  total:        number
  client_name:  string | null
  carrier_name: string | null
  wilaya_name:  string | null
}

export interface PickupsConfig {
  status:       string
  title:        string
  subtitle?:    string
  emptyText:    string
  dateField:    keyof PickupRow
  primaryAction?: { label: string; action: string; color?: string }
  showGoBack?:  boolean
  showCancel?:  boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LIMIT = 25

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Checkbox({
  checked, indeterminate, onChange,
}: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate }, [indeterminate])
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
          <div style={{
            height: 12, borderRadius: 3, background: '#ececec',
            width: i === 0 ? 14 : `${50 + (i % 3) * 18}%`,
          }} />
        </td>
      ))}
    </tr>
  )
}

function ActionBtn({
  label, onClick, loading, color, outline, icon,
}: {
  label: string; onClick: () => void; loading: boolean
  color?: string; outline?: boolean; icon?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 9px', borderRadius: 4, fontSize: 11.5, fontFamily: fonts.sans,
        cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
        border: outline ? `1px solid ${colors.border}` : 'none',
        background: outline ? '#fff' : loading ? '#ccc' : (color ?? colors.primary),
        color: outline ? colors.textMd : '#fff',
        transition: 'background .12s, border-color .12s, color .12s',
      }}
      onMouseEnter={e => {
        if (!loading && outline) {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.primary
          ;(e.currentTarget as HTMLButtonElement).style.color = colors.primary
        }
      }}
      onMouseLeave={e => {
        if (!loading && outline) {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = colors.border
          ;(e.currentTarget as HTMLButtonElement).style.color = colors.textMd
        }
      }}
    >
      {loading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : icon}
      {loading ? '…' : label}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PickupsPage({ config }: { config: PickupsConfig }) {
  const { boutiqueId } = useBoutique()

  const [items,    setItems]    = useState<PickupRow[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [dbSearch, setDbSearch] = useState('')

  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [actionLoading,  setActionLoading]  = useState<Record<string, boolean>>({})
  const [bulkLoading,    setBulkLoading]    = useState(false)

  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const boutiqueIdRef = useRef(boutiqueId)
  useEffect(() => { boutiqueIdRef.current = boutiqueId }, [boutiqueId])

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchItems = useCallback(() => {
    const bid = boutiqueIdRef.current
    if (!bid) return
    setLoading(true)
    const qs = new URLSearchParams({
      status:      config.status,
      boutique_id: bid,
      page:        String(page),
      limit:       String(LIMIT),
      search:      dbSearch,
    })
    fetch(`/api/pickups?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setTotal(d.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [config.status, page, dbSearch])

  useEffect(() => { if (boutiqueId) fetchItems() }, [boutiqueId, fetchItems])

  // ── Search ─────────────────────────────────────────────────────────────────

  function handleSearchChange(val: string) {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDbSearch(val); setPage(1) }, 300)
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length && items.length > 0) setSelectedIds(new Set())
    else setSelectedIds(new Set(items.map(r => r.id)))
  }

  // ── Single action ──────────────────────────────────────────────────────────

  async function doAction(pickupId: string, action: string) {
    const key = pickupId + action
    setActionLoading(p => ({ ...p, [key]: true }))
    try {
      const res = await fetch(`/api/pickups/${pickupId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body:    JSON.stringify({ action }),
      })
      if (res.ok) fetchItems()
    } finally {
      setActionLoading(p => ({ ...p, [key]: false }))
    }
  }

  // ── Bulk action ────────────────────────────────────────────────────────────

  async function doBulkAction(action: string) {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBulkLoading(true)
    try {
      await Promise.all(ids.map(id =>
        fetch(`/api/pickups/${id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body:    JSON.stringify({ action }),
        })
      ))
      setSelectedIds(new Set())
      fetchItems()
    } finally {
      setBulkLoading(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const allSelected  = items.length > 0 && selectedIds.size === items.length
  const someSelected = selectedIds.size > 0 && !allSelected
  const nSelected    = selectedIds.size
  const COLS         = 8

  // ── Table helpers ──────────────────────────────────────────────────────────

  const TH = ({ children, width, center }: { children: React.ReactNode; width?: number; center?: boolean }) => (
    <th style={{
      fontSize: 11.5, fontWeight: 600, color: colors.textMd,
      padding: '8px 10px', textAlign: center ? 'center' : 'left',
      whiteSpace: 'nowrap', width, background: '#f5f5f5',
    }}>
      {children}
    </th>
  )

  const TD = ({ children, center }: { children: React.ReactNode; center?: boolean }) => (
    <td style={{
      fontSize: 12.5, padding: '8px 10px',
      color: colors.text,
      borderBottom: `1px solid ${colors.border}`,
      textAlign: center ? 'center' : 'left',
      verticalAlign: 'middle',
    }}>
      {children}
    </td>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title={config.title}
        subtitle={
          total > 0
            ? `${total} pickup${total > 1 ? 's' : ''}`
            : (config.subtitle ?? '')
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: '1 1 200px', maxWidth: 260 }}>
            <SearchInput
              value={search}
              onChange={handleSearchChange}
              placeholder="Référence commande…"
            />
          </div>
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

            {config.primaryAction && (
              <ActionBtn
                icon={<Check size={12} />}
                label={config.primaryAction.label}
                onClick={() => doBulkAction(config.primaryAction!.action)}
                loading={bulkLoading}
                color={config.primaryAction.color ?? colors.primary}
              />
            )}

            {config.showGoBack && (
              <ActionBtn
                icon={<RotateCcw size={12} />}
                label="Retour"
                onClick={() => doBulkAction('go_back')}
                loading={bulkLoading}
                outline
              />
            )}

            {config.showCancel && (
              <ActionBtn
                icon={<XCircle size={12} />}
                label="Annuler"
                onClick={() => doBulkAction('cancel')}
                loading={bulkLoading}
                color={colors.red}
              />
            )}

            <button
              onClick={() => setSelectedIds(new Set())}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', color: colors.textLt,
                display: 'flex', alignItems: 'center', padding: 4,
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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                <TH width={36}>
                  <Checkbox checked={allSelected} indeterminate={someSelected} onChange={toggleSelectAll} />
                </TH>
                <TH width={115}>Référence</TH>
                <TH width={160}>Client</TH>
                <TH width={130}>Livreur</TH>
                <TH width={100}>Wilaya</TH>
                <TH width={95}>Date</TH>
                <TH width={55} center>Sync</TH>
                <TH>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={COLS} />)
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={COLS} style={{
                    textAlign: 'center', padding: '40px 12px',
                    color: colors.textLt, fontSize: 13,
                  }}>
                    <Package size={28} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    {config.emptyText}
                  </td>
                </tr>
              ) : (
                items.map(row => {
                  const isSelected = selectedIds.has(row.id)
                  const dateVal = row[config.dateField] as string | null

                  return (
                    <tr
                      key={row.id}
                      style={{
                        background: isSelected ? colors.primaryLt : undefined,
                        transition: 'background .1s',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = '#fafafa'
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = ''
                      }}
                    >
                      <TD center>
                        <Checkbox checked={isSelected} onChange={() => toggleSelect(row.id)} />
                      </TD>
                      <TD>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 600, fontSize: 12,
                          color: colors.primary,
                        }}>
                          {row.reference || '—'}
                        </span>
                      </TD>
                      <TD>{row.client_name || <span style={{ color: colors.textLt }}>—</span>}</TD>
                      <TD>{row.carrier_name || <span style={{ color: colors.textLt }}>—</span>}</TD>
                      <TD>{row.wilaya_name || '—'}</TD>
                      <TD>
                        <span style={{ fontSize: 12, color: colors.textMd }}>
                          {fmtDate(dateVal)}
                        </span>
                      </TD>
                      <TD center>
                        {row.sync_enabled
                          ? <Wifi size={14} color={colors.green} />
                          : <WifiOff size={14} color={colors.textLt} />
                        }
                      </TD>
                      <TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {config.primaryAction && (
                            <ActionBtn
                              icon={<Check size={11} />}
                              label={config.primaryAction.label}
                              onClick={() => doAction(row.id, config.primaryAction!.action)}
                              loading={!!actionLoading[row.id + config.primaryAction.action]}
                              color={config.primaryAction.color ?? colors.primary}
                            />
                          )}
                          {config.showGoBack && (
                            <ActionBtn
                              icon={<RotateCcw size={11} />}
                              label="Retour"
                              onClick={() => doAction(row.id, 'go_back')}
                              loading={!!actionLoading[row.id + 'go_back']}
                              outline
                            />
                          )}
                          {config.showCancel && (
                            <ActionBtn
                              icon={<XCircle size={11} />}
                              label="Annuler"
                              onClick={() => doAction(row.id, 'cancel')}
                              loading={!!actionLoading[row.id + 'cancel']}
                              color={colors.red}
                            />
                          )}
                        </div>
                      </TD>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {total > LIMIT && (
          <Pagination page={page} total={total} limit={LIMIT} onChange={p => setPage(p)} />
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
