'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/ui'
import StatsFilters, { type StatsFiltersValue } from '@/components/stats/StatsFilters'
import StatsTable, { type StatsRow } from '@/components/stats/StatsTable'
import StatsChart from '@/components/stats/StatsChart'
import { colors, fonts } from '@/lib/tokens'

const DIMENSIONS = [
  { value: 'wilaya',    label: 'Wilaya' },
  { value: 'commune',   label: 'Commune' },
  { value: 'carrier',   label: 'Livreur' },
  { value: 'product',   label: 'Produit' },
  { value: 'variant',   label: 'Variante' },
  { value: 'confirmer', label: 'Confirmateur' },
]

const todayStr = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => {
  const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
}

function authHeader(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

export default function StatsBoutiquePage() {
  const [boutiques, setBoutiques] = useState<{ id: string; name: string }[]>([])
  const [dimension, setDimension] = useState('wilaya')
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
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setBoutiques(d)
        else if (d && !d.error) setBoutiques([])  // handle unexpected format gracefully
      })
      .catch(() => {})
  }, [])

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
    fetch(`/api/stats?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.rows)) setRows(d.rows) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dimension, filters])

  useEffect(() => { fetchStats() }, [fetchStats])

  const dimLabel = DIMENSIONS.find(d => d.value === dimension)?.label ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.bg, fontFamily: fonts.sans }}>
      <PageHeader title="Stats par boutique" subtitle="Performance des commandes selon différentes dimensions" />
      <StatsFilters value={filters} onChange={setFilters} boutiques={boutiques} />

      {/* Dimension picker */}
      <DimBar dimensions={DIMENSIONS} value={dimension} onChange={setDimension} />

      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <StatsTable
          rows={rows}
          loading={loading}
          displayMode={filters.displayMode}
          dimensionLabel={dimLabel}
        />
        {!loading && rows.length > 0 && (
          <StatsChart rows={rows} displayMode={filters.displayMode} />
        )}
      </div>
    </div>
  )
}

function DimBar({ dimensions, value, onChange }: {
  dimensions: { value: string; label: string }[]
  value:      string
  onChange:   (v: string) => void
}) {
  return (
    <div style={{
      background: '#fff',
      borderBottom: `1px solid ${colors.border}`,
      padding: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span style={{ fontSize: 12, color: colors.textMd, fontWeight: 500, marginRight: 4 }}>Trier par</span>
      {dimensions.map(d => (
        <button
          key={d.value}
          onClick={() => onChange(d.value)}
          style={{
            fontSize: 12,
            padding: '4px 12px',
            borderRadius: 4,
            border: `1px solid ${value === d.value ? colors.primary : colors.border}`,
            background: value === d.value ? colors.primaryLt : '#fff',
            color: value === d.value ? colors.primary : colors.textMd,
            cursor: 'pointer',
            fontFamily: fonts.sans,
            fontWeight: value === d.value ? 600 : 400,
            transition: 'all 0.12s',
          }}
        >
          {d.label}
        </button>
      ))}
    </div>
  )
}
