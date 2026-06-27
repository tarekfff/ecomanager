'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/ui'
import StatsFilters, { type StatsFiltersValue } from '@/components/stats/StatsFilters'
import StatsTable, { type StatsRow } from '@/components/stats/StatsTable'
import StatsChart from '@/components/stats/StatsChart'
import { colors, fonts } from '@/lib/tokens'

const DIMENSIONS = [
  { value: 'carrier',   label: 'Livreur' },
  { value: 'product',   label: 'Produit' },
  { value: 'variant',   label: 'Variante' },
  { value: 'confirmer', label: 'Confirmateur' },
  { value: 'commune',   label: 'Commune' },
  { value: 'boutique',  label: 'Boutique' },
]

interface Wilaya  { id: number; name: string; code: string }
interface Commune { id: number; name: string }

const todayStr     = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

function authHeader(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

export default function StatsWilayaPage() {
  const [boutiques, setBoutiques] = useState<{ id: string; name: string }[]>([])
  const [wilayas,   setWilayas]   = useState<Wilaya[]>([])
  const [communes,  setCommunes]  = useState<Commune[]>([])
  const [wilayaId,  setWilayaId]  = useState('')
  const [communeId, setCommuneId] = useState('')
  const [dimension, setDimension] = useState('carrier')
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
    fetch('/api/wilayas')
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setWilayas(d) }).catch(() => {})
  }, [])

  // Load communes when wilaya changes
  useEffect(() => {
    setCommuneId('')
    setCommunes([])
    if (!wilayaId) return
    fetch(`/api/communes?wilaya_id=${wilayaId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setCommunes(d) })
      .catch(() => {})
  }, [wilayaId])

  const fetchStats = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({
      dimension,
      boutique_id: filters.boutiqueId,
      from:        filters.from,
      to:          filters.to,
      base:        filters.base,
      date_field:  filters.dateField,
      result_by:   filters.resultBy,
    })
    if (wilayaId)  qs.set('wilaya_id',  wilayaId)
    if (communeId) qs.set('commune_id', communeId)

    fetch(`/api/stats?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.rows)) setRows(d.rows) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dimension, filters, wilayaId, communeId])

  useEffect(() => { fetchStats() }, [fetchStats])

  const dimLabel = DIMENSIONS.find(d => d.value === dimension)?.label ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.bg, fontFamily: fonts.sans }}>
      <PageHeader title="Stats par wilaya" subtitle="Performance géographique par statut et dimension" />
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
        <div style={{ minWidth: 200 }}>
          <label style={lbl}>Wilaya</label>
          <select value={wilayaId} onChange={e => setWilayaId(e.target.value)} style={sel}>
            <option value="">Toutes les wilayas</option>
            {wilayas.map(w => (
              <option key={w.id} value={String(w.id)}>{w.id} — {w.name}</option>
            ))}
          </select>
        </div>

        {communes.length > 0 && (
          <div style={{ minWidth: 200 }}>
            <label style={lbl}>Commune</label>
            <select value={communeId} onChange={e => setCommuneId(e.target.value)} style={sel}>
              <option value="">Toutes les communes</option>
              {communes.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </div>
        )}

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
