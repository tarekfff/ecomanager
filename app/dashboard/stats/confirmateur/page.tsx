'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/ui'
import StatsFilters, { type StatsFiltersValue } from '@/components/stats/StatsFilters'
import StatsTable, { type StatsRow } from '@/components/stats/StatsTable'
import StatsChart from '@/components/stats/StatsChart'
import { colors, fonts } from '@/lib/tokens'

const DIMENSIONS = [
  { value: 'product',   label: 'Produit' },
  { value: 'variant',   label: 'Variante' },
  { value: 'carrier',   label: 'Livreur' },
  { value: 'wilaya',    label: 'Wilaya' },
  { value: 'commune',   label: 'Commune' },
  { value: 'boutique',  label: 'Boutique' },
]

interface AppUser { id: string; name: string }

const todayStr     = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

function authHeader(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

export default function StatsConfirmateurPage() {
  const [boutiques,   setBoutiques]   = useState<{ id: string; name: string }[]>([])
  const [users,       setUsers]       = useState<AppUser[]>([])
  const [confirmerId, setConfirmerId] = useState('')
  const [dimension,   setDimension]   = useState('product')
  const [filters, setFilters] = useState<StatsFiltersValue>({
    boutiqueId:  '',
    base:        'all',
    dateField:   'created',
    from:        firstOfMonth(),
    to:          todayStr(),
    resultBy:    'count',
    displayMode: 'number',
  })
  const [rows, setRows]       = useState<StatsRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/boutiques', { headers: authHeader() })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setBoutiques(d) }).catch(() => {})

    fetch('/api/users', { headers: authHeader() })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setUsers(d) }).catch(() => {})
  }, [])

  const fetchStats = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({
      dimension,
      boutique_id:  filters.boutiqueId,
      from:         filters.from,
      to:           filters.to,
      base:         filters.base,
      date_field:   filters.dateField,
      result_by:    filters.resultBy,
    })
    if (confirmerId) qs.set('confirmer_id', confirmerId)

    fetch(`/api/stats?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.rows)) setRows(d.rows) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dimension, filters, confirmerId])

  useEffect(() => { fetchStats() }, [fetchStats])

  const dimLabel = DIMENSIONS.find(d => d.value === dimension)?.label ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.bg, fontFamily: fonts.sans }}>
      <PageHeader title="Stats par confirmateur" subtitle="Performance par agent de confirmation" />
      <StatsFilters value={filters} onChange={setFilters} boutiques={boutiques} />

      {/* Extra filters + dimension */}
      <div style={{
        background: '#fff',
        borderBottom: `1px solid ${colors.border}`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 220 }}>
          <label style={lbl}>Confirmateur</label>
          <select value={confirmerId} onChange={e => setConfirmerId(e.target.value)} style={sel}>
            <option value="">Tous les confirmateurs</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: colors.textMd, fontWeight: 500 }}>Trier par</span>
          {DIMENSIONS.map(d => (
            <DimBtn key={d.value} label={d.label} active={dimension === d.value} onClick={() => setDimension(d.value)} />
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <StatsTable rows={rows} loading={loading} displayMode={filters.displayMode} dimensionLabel={dimLabel} />
        {!loading && rows.length > 0 && (
          <StatsChart rows={rows} displayMode={filters.displayMode} />
        )}
      </div>
    </div>
  )
}

function DimBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 12, padding: '4px 12px', borderRadius: 4,
      border: `1px solid ${active ? colors.primary : colors.border}`,
      background: active ? colors.primaryLt : '#fff',
      color: active ? colors.primary : colors.textMd,
      cursor: 'pointer', fontFamily: fonts.sans, fontWeight: active ? 600 : 400,
    }}>
      {label}
    </button>
  )
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, color: colors.textMd, marginBottom: 3, fontWeight: 500,
}
const sel: React.CSSProperties = {
  border: `1px solid ${colors.border}`, borderRadius: 4, padding: '6px 8px',
  fontSize: 12.5, fontFamily: fonts.sans, color: colors.text, background: '#fff',
  outline: 'none', cursor: 'pointer',
}
