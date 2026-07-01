'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui'
import StatsFilters, { type StatsFiltersValue } from '@/components/stats/StatsFilters'
import StatsTable, { type StatsRow } from '@/components/stats/StatsTable'
import StatsChart from '@/components/stats/StatsChart'
import { colors, fonts } from '@/lib/tokens'

const todayStr = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => {
  const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
}

function authHeader(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

export default function StatsBoutiquePage() {
  const { t } = useTranslation('stats')
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

  const DIMENSIONS = [
    { value: 'wilaya',    label: t('dims.wilaya')    },
    { value: 'commune',   label: t('dims.commune')   },
    { value: 'carrier',   label: t('dims.carrier')   },
    { value: 'product',   label: t('dims.product')   },
    { value: 'variant',   label: t('dims.variant')   },
    { value: 'confirmer', label: t('dims.confirmer') },
  ]

  useEffect(() => {
    fetch('/api/boutiques', { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setBoutiques(d) })
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
      <PageHeader title={t('boutique.title')} subtitle={t('boutique.subtitle')} />
      <StatsFilters value={filters} onChange={setFilters} boutiques={boutiques} />

      <DimBar dimensions={DIMENSIONS} value={dimension} onChange={setDimension} sortByLabel={t('sortBy')} />

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

function DimBar({ dimensions, value, onChange, sortByLabel }: {
  dimensions:   { value: string; label: string }[]
  value:        string
  onChange:     (v: string) => void
  sortByLabel:  string
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
      <span style={{ fontSize: 12, color: colors.textMd, fontWeight: 500, marginRight: 4 }}>{sortByLabel}</span>
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
