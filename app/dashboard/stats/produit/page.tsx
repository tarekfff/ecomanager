'use client'

import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '@/components/ui'
import StatsFilters, { type StatsFiltersValue } from '@/components/stats/StatsFilters'
import StatsTable, { type StatsRow } from '@/components/stats/StatsTable'
import StatsChart from '@/components/stats/StatsChart'
import { colors, fonts } from '@/lib/tokens'

const DIMENSIONS = [
  { value: 'confirmer', label: 'Confirmateur' },
  { value: 'carrier',   label: 'Livreur' },
  { value: 'wilaya',    label: 'Wilaya' },
  { value: 'commune',   label: 'Commune' },
  { value: 'variant',   label: 'Variante' },
  { value: 'boutique',  label: 'Boutique' },
]

interface Product { id: string; name: string; sku: string }
interface Variant { id: string; sku: string; price: number | null; is_active: boolean }

const todayStr     = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

function authHeader(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

export default function StatsProduitPage() {
  const [boutiques,     setBoutiques]     = useState<{ id: string; name: string }[]>([])
  const [products,      setProducts]      = useState<Product[]>([])
  const [variants,      setVariants]      = useState<Variant[]>([])
  const [productId,     setProductId]     = useState('')
  const [variantId,     setVariantId]     = useState('')
  const [loadingProds,  setLoadingProds]  = useState(true)
  const [loadingVars,   setLoadingVars]   = useState(false)
  const [dimension,     setDimension]     = useState('wilaya')
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

  // Load boutiques + ALL tenant products on mount (no boutique required)
  useEffect(() => {
    fetch('/api/boutiques', { headers: authHeader() })
      .then(r => r.json()).then(d => { if (Array.isArray(d)) setBoutiques(d) }).catch(() => {})

    setLoadingProds(true)
    fetch('/api/stats/products', { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setProducts(d) })
      .catch(() => {})
      .finally(() => setLoadingProds(false))
  }, [])

  // Load variants when product changes
  useEffect(() => {
    setVariantId('')
    setVariants([])
    if (!productId) return
    setLoadingVars(true)
    fetch(`/api/products/${productId}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => {
        // product_variants is the key from the products/[id] API
        const vars = d.product_variants ?? d.variants ?? []
        if (Array.isArray(vars)) setVariants(vars.filter((v: Variant) => v.is_active))
      })
      .catch(() => {})
      .finally(() => setLoadingVars(false))
  }, [productId])

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
    if (productId) qs.set('product_id', productId)
    if (variantId) qs.set('variant_id', variantId)

    fetch(`/api/stats?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.rows)) setRows(d.rows) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dimension, filters, productId, variantId])

  useEffect(() => { fetchStats() }, [fetchStats])

  const dimLabel = DIMENSIONS.find(d => d.value === dimension)?.label ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.bg, fontFamily: fonts.sans }}>
      <PageHeader title="Stats par produit" subtitle="Performance des produits par statut et dimension" />
      <StatsFilters value={filters} onChange={setFilters} boutiques={boutiques} />

      {/* Extra filters + dimension bar */}
      <div style={{
        background: '#fff',
        borderBottom: `1px solid ${colors.border}`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        {/* Product selector */}
        <div style={{ minWidth: 260 }}>
          <label style={lbl}>
            Produit {loadingProds && <span style={{ color: colors.textLt, fontWeight: 400 }}>— chargement…</span>}
          </label>
          <select
            value={productId}
            onChange={e => { setProductId(e.target.value); setVariantId('') }}
            style={{ ...sel, minWidth: 260 }}
            disabled={loadingProds}
          >
            <option value="">Tous les produits ({products.length})</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}{p.sku ? ` — ${p.sku}` : ''}</option>
            ))}
          </select>
        </div>

        {/* Variant selector — only when product selected */}
        {productId && (
          <div style={{ minWidth: 200 }}>
            <label style={lbl}>
              Variante {loadingVars && <span style={{ color: colors.textLt, fontWeight: 400 }}>— chargement…</span>}
            </label>
            <select
              value={variantId}
              onChange={e => setVariantId(e.target.value)}
              style={sel}
              disabled={loadingVars}
            >
              <option value="">Toutes les variantes</option>
              {variants.map(v => (
                <option key={v.id} value={v.id}>{v.sku}</option>
              ))}
            </select>
          </div>
        )}

        {/* Dimension pills */}
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
