'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader, Table, Pagination, Select } from '@/components/ui'
import type { Column } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Batch {
  id:             string
  batch_number:   string | null
  quantity:       number
  unit_cost:      number | null
  expiry_date:    string | null
  created_at:     string
  product_name:   string
  product_sku:    string | null
  variant_sku:    string | null
  warehouse_name: string
}

interface Product   { id: string; name: string; sku: string | null }
interface Warehouse { id: string; name: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const LIMIT = 25

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHdr() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-DZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fmtCost(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('fr-DZ') + ' DA'
}

function isExpiringSoon(d: string | null): boolean {
  if (!d) return false
  const diff = new Date(d).getTime() - Date.now()
  return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000
}

function isExpired(d: string | null): boolean {
  if (!d) return false
  return new Date(d).getTime() < Date.now()
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LotsPage() {
  const { t } = useTranslation('stock')
  const [items,    setItems]    = useState<Batch[]>([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(false)

  // Filters
  const [warehouses,   setWarehouses]   = useState<Warehouse[]>([])
  const [warehouseId,  setWarehouseId]  = useState('')
  const [prodQuery,    setProdQuery]    = useState('')
  const [prodResults,  setProdResults]  = useState<Product[]>([])
  const [showDrop,     setShowDrop]     = useState(false)
  const [product,      setProduct]      = useState<Product | null>(null)

  // Applied
  const [appliedProductId,   setAppliedProductId]   = useState('')
  const [appliedWarehouseId, setAppliedWarehouseId] = useState('')

  const debRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Load warehouses
  useEffect(() => {
    fetch('/api/warehouses', { headers: authHdr() })
      .then(r => r.json())
      .then(d => setWarehouses(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // Product autocomplete
  useEffect(() => {
    if (product || prodQuery.length < 2) { setProdResults([]); setShowDrop(false); return }
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(prodQuery)}&limit=10`, { headers: authHdr() })
        .then(r => r.json())
        .then(d => { const it = d.items ?? []; setProdResults(it); setShowDrop(it.length > 0) })
        .catch(() => {})
    }, 300)
  }, [prodQuery, product])

  // Close dropdown
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Fetch batches
  const fetchData = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (appliedProductId)   qs.set('product_id',   appliedProductId)
    if (appliedWarehouseId) qs.set('warehouse_id', appliedWarehouseId)

    fetch(`/api/stock/batches?${qs}`, { headers: authHdr() })
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setTotal(d.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, appliedProductId, appliedWarehouseId])

  useEffect(() => { fetchData() }, [fetchData])

  function pickProduct(p: Product) {
    setProduct(p); setProdQuery(p.name)
    setShowDrop(false); setProdResults([])
  }

  function clearProduct() {
    setProduct(null); setProdQuery('')
    setProdResults([]); setShowDrop(false)
  }

  function applyFilters() {
    setAppliedProductId(product?.id ?? '')
    setAppliedWarehouseId(warehouseId)
    setPage(1)
  }

  function resetFilters() {
    clearProduct(); setWarehouseId('')
    setAppliedProductId(''); setAppliedWarehouseId('')
    setPage(1)
  }

  const columns: Column<Batch>[] = [
    {
      key: 'product_name', label: t('lots.cols.product'),
      render: r => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.product_name}</div>
          {r.product_sku && (
            <div style={{ fontSize: 11, color: colors.textLt }}>SKU: {r.product_sku}</div>
          )}
        </div>
      ),
    },
    {
      key: 'variant_sku', label: t('lots.cols.variant'), width: 110,
      render: r => <span style={{ color: colors.textMd }}>{r.variant_sku ?? '—'}</span>,
    },
    {
      key: 'warehouse_name', label: t('lots.cols.warehouse'), width: 130,
      render: r => <span>{r.warehouse_name}</span>,
    },
    {
      key: 'batch_number', label: t('lots.cols.batchNo'), width: 110,
      render: r => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {r.batch_number ?? '—'}
        </span>
      ),
    },
    {
      key: 'quantity', label: t('lots.cols.qty'), width: 90,
      render: r => (
        <span style={{ fontWeight: 600, color: r.quantity === 0 ? colors.textLt : colors.text }}>
          {r.quantity}
        </span>
      ),
    },
    {
      key: 'unit_cost', label: t('lots.cols.unitCost'), width: 110,
      render: r => <span style={{ color: colors.textMd }}>{fmtCost(r.unit_cost)}</span>,
    },
    {
      key: 'expiry_date', label: t('lots.cols.expiry'), width: 140,
      render: r => {
        const soon    = isExpiringSoon(r.expiry_date)
        const expired = isExpired(r.expiry_date)
        return (
          <span style={{
            fontWeight: (soon || expired) ? 600 : 400,
            color: expired ? colors.red : soon ? colors.orange : colors.textMd,
          }}>
            {fmtDate(r.expiry_date)}
            {soon    && !expired && <span style={{ marginLeft: 4, fontSize: 10 }}>{t('lots.expiringSoon')}</span>}
            {expired && <span style={{ marginLeft: 4, fontSize: 10 }}>{t('lots.expired')}</span>}
          </span>
        )
      },
    },
  ]

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${colors.border}`, borderRadius: 4,
    padding: '6px 10px', fontSize: 13, fontFamily: fonts.sans,
    outline: 'none', background: '#fff', color: colors.text,
    boxSizing: 'border-box',
  }

  return (
    <>
      <PageHeader
        title={t('lots.title')}
        subtitle={t('lots.subtitle')}
      />

      {/* Filter bar */}
      <div style={{
        padding: '10px 16px', background: '#fff',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end',
      }}>

        {/* Product autocomplete */}
        <div ref={dropRef} style={{ position: 'relative', width: 220 }}>
          <div style={{ fontSize: 11, color: colors.textMd, marginBottom: 3, fontFamily: fonts.sans }}>{t('lots.productLabel')}</div>
          <div style={{ position: 'relative' }}>
            <input
              value={prodQuery}
              onChange={e => { setProdQuery(e.target.value); if (product) clearProduct() }}
              onFocus={() => { if (prodResults.length > 0) setShowDrop(true) }}
              placeholder={t('lots.searchPh')}
              style={{ ...inputStyle, width: '100%', paddingRight: product ? 26 : 10 }}
            />
            {product && (
              <button
                onClick={clearProduct}
                style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: colors.textLt, fontSize: 15, lineHeight: 1, padding: 0,
                }}
              >×</button>
            )}
          </div>
          {showDrop && prodResults.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
              background: '#fff', border: `1px solid ${colors.border}`,
              borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              maxHeight: 200, overflowY: 'auto', marginTop: 2,
            }}>
              {prodResults.map(p => (
                <div
                  key={p.id}
                  onMouseDown={() => pickProduct(p)}
                  style={{ padding: '7px 10px', cursor: 'pointer', fontSize: 13, fontFamily: fonts.sans }}
                  onMouseEnter={e => (e.currentTarget.style.background = colors.primaryLt)}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  {p.name}
                  {p.sku && <span style={{ color: colors.textLt, marginLeft: 6, fontSize: 11 }}>{p.sku}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Warehouse */}
        <div style={{ width: 170 }}>
          <div style={{ fontSize: 11, color: colors.textMd, marginBottom: 3, fontFamily: fonts.sans }}>{t('lots.warehouseLabel')}</div>
          <Select
            value={warehouseId}
            onChange={setWarehouseId}
            placeholder={t('lots.warehouseAll')}
            options={warehouses.map(w => ({ value: w.id, label: w.name }))}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-end' }}>
          <button
            onClick={applyFilters}
            style={{
              padding: '6px 14px', borderRadius: 4, fontSize: 13, fontFamily: fonts.sans,
              background: colors.primary, color: '#fff',
              border: `1px solid ${colors.primary}`, cursor: 'pointer', fontWeight: 500,
            }}
          >
            {t('lots.filterBtn')}
          </button>
          <button
            onClick={resetFilters}
            style={{
              padding: '6px 12px', borderRadius: 4, fontSize: 13, fontFamily: fonts.sans,
              background: '#fff', color: colors.textMd,
              border: `1px solid ${colors.border}`, cursor: 'pointer',
            }}
          >
            {t('lots.resetBtn')}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        padding: '6px 16px', background: '#fffdf5',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex', gap: 20, fontSize: 11.5, fontFamily: fonts.sans,
      }}>
        <span style={{ color: colors.orange, fontWeight: 500 }}>{t('lots.legendSoon')}</span>
        <span style={{ color: colors.red,    fontWeight: 500 }}>{t('lots.legendExpired')}</span>
      </div>

      <div style={{ padding: '16px' }}>
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyText={t('lots.empty')}
        />
        {total > LIMIT && (
          <div style={{ marginTop: 12 }}>
            <Pagination page={page} total={total} limit={LIMIT} onChange={p => setPage(p)} />
          </div>
        )}
      </div>
    </>
  )
}
