'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { PageHeader, Table, Pagination, Badge, Select } from '@/components/ui'
import type { Column } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Movement {
  id:             string
  operation_type: 'add' | 'remove' | 'correct'
  target_type:    'new_batch' | 'global' | 'existing_batch'
  quantity:       number
  unit_cost:      number | null
  comment:        string | null
  created_at:     string
  product_name:   string
  product_sku:    string | null
  variant_sku:    string | null
  warehouse_name: string
  user_name:      string
  batch_number:   string | null
}

interface Product   { id: string; name: string; sku: string | null }
interface Warehouse { id: string; name: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const LIMIT = 25

const OP_LABEL: Record<string, string> = {
  add:     'Ajouter',
  remove:  'Retirer',
  correct: 'Corriger',
}

const OP_COLOR: Record<string, 'green' | 'red' | 'blue'> = {
  add:     'green',
  remove:  'red',
  correct: 'blue',
}

const TARGET_LABEL: Record<string, string> = {
  new_batch:      'Nouveau lot',
  global:         'Stock global',
  existing_batch: 'Lot existant',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHdr() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('fr-DZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtCost(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('fr-DZ') + ' DA'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QtyCell({ op, qty }: { op: string; qty: number }) {
  const color = op === 'add' ? colors.green : op === 'remove' ? colors.red : colors.blue
  const prefix = op === 'add' ? '+' : op === 'remove' ? '−' : ''
  return (
    <span style={{ fontWeight: 600, color, fontFamily: fonts.sans }}>
      {prefix}{qty}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MouvementsPage() {
  const [items,      setItems]      = useState<Movement[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(false)

  // Filters
  const [warehouses,   setWarehouses]   = useState<Warehouse[]>([])
  const [warehouseId,  setWarehouseId]  = useState('')
  const [opFilter,     setOpFilter]     = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')

  // Product autocomplete
  const [prodQuery,    setProdQuery]    = useState('')
  const [prodResults,  setProdResults]  = useState<Product[]>([])
  const [showDrop,     setShowDrop]     = useState(false)
  const [product,      setProduct]      = useState<Product | null>(null)

  // Applied filter values (committed on search click or product pick)
  const [appliedProductId,   setAppliedProductId]   = useState('')
  const [appliedWarehouseId, setAppliedWarehouseId] = useState('')
  const [appliedOp,          setAppliedOp]          = useState('')
  const [appliedDateFrom,    setAppliedDateFrom]     = useState('')
  const [appliedDateTo,      setAppliedDateTo]       = useState('')

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

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Fetch movements
  const fetchData = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (appliedProductId)   qs.set('product_id',     appliedProductId)
    if (appliedWarehouseId) qs.set('warehouse_id',   appliedWarehouseId)
    if (appliedOp)          qs.set('operation_type', appliedOp)
    if (appliedDateFrom)    qs.set('date_from',      appliedDateFrom)
    if (appliedDateTo)      qs.set('date_to',        appliedDateTo)

    fetch(`/api/stock/movements?${qs}`, { headers: authHdr() })
      .then(r => r.json())
      .then(d => { setItems(d.items ?? []); setTotal(d.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, appliedProductId, appliedWarehouseId, appliedOp, appliedDateFrom, appliedDateTo])

  useEffect(() => { fetchData() }, [fetchData])

  function pickProduct(p: Product) {
    setProduct(p)
    setProdQuery(p.name)
    setShowDrop(false)
    setProdResults([])
  }

  function clearProduct() {
    setProduct(null)
    setProdQuery('')
    setProdResults([])
    setShowDrop(false)
  }

  function applyFilters() {
    setAppliedProductId(product?.id ?? '')
    setAppliedWarehouseId(warehouseId)
    setAppliedOp(opFilter)
    setAppliedDateFrom(dateFrom)
    setAppliedDateTo(dateTo)
    setPage(1)
  }

  function resetFilters() {
    clearProduct()
    setWarehouseId('')
    setOpFilter('')
    setDateFrom('')
    setDateTo('')
    setAppliedProductId('')
    setAppliedWarehouseId('')
    setAppliedOp('')
    setAppliedDateFrom('')
    setAppliedDateTo('')
    setPage(1)
  }

  const columns: Column<Movement>[] = [
    {
      key: 'created_at', label: 'Date', width: 130,
      render: r => <span style={{ fontSize: 12, color: colors.textMd }}>{fmtDate(r.created_at)}</span>,
    },
    {
      key: 'product_name', label: 'Produit',
      render: r => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.product_name}</div>
          {r.variant_sku && (
            <div style={{ fontSize: 11, color: colors.textLt }}>Var: {r.variant_sku}</div>
          )}
        </div>
      ),
    },
    {
      key: 'warehouse_name', label: 'Entrepôt', width: 120,
      render: r => <span>{r.warehouse_name}</span>,
    },
    {
      key: 'operation_type', label: 'Opération', width: 100,
      render: r => (
        <Badge color={OP_COLOR[r.operation_type] ?? 'gray'}>
          {OP_LABEL[r.operation_type] ?? r.operation_type}
        </Badge>
      ),
    },
    {
      key: 'target_type', label: 'Cible', width: 110,
      render: r => (
        <span style={{ fontSize: 12, color: colors.textMd }}>
          {TARGET_LABEL[r.target_type] ?? r.target_type}
        </span>
      ),
    },
    {
      key: 'quantity', label: 'Quantité', width: 80,
      render: r => <QtyCell op={r.operation_type} qty={r.quantity} />,
    },
    {
      key: 'unit_cost', label: 'Prix achat', width: 100,
      render: r => <span style={{ color: colors.textMd }}>{fmtCost(r.unit_cost)}</span>,
    },
    {
      key: 'batch_number', label: 'Lot', width: 100,
      render: r => (
        <span style={{ fontSize: 12, color: colors.textMd }}>
          {r.batch_number ?? '—'}
        </span>
      ),
    },
    {
      key: 'comment', label: 'Commentaire',
      render: r => (
        <span style={{ fontSize: 12, color: colors.textMd, fontStyle: r.comment ? 'normal' : 'italic' }}>
          {r.comment ?? '—'}
        </span>
      ),
    },
    {
      key: 'user_name', label: 'Utilisateur', width: 120,
      render: r => <span style={{ fontSize: 12 }}>{r.user_name}</span>,
    },
  ]

  // ── Filter bar styles ──────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    border: `1px solid ${colors.border}`, borderRadius: 4,
    padding: '6px 10px', fontSize: 13, fontFamily: fonts.sans,
    outline: 'none', background: '#fff', color: colors.text,
    boxSizing: 'border-box',
  }

  return (
    <>
      <PageHeader
        title="Mouvements de stock"
        subtitle="Historique de tous les ajustements de stock."
      />

      {/* Filter bar */}
      <div style={{
        padding: '10px 16px', background: '#fff',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end',
      }}>

        {/* Product autocomplete */}
        <div ref={dropRef} style={{ position: 'relative', width: 220 }}>
          <div style={{ fontSize: 11, color: colors.textMd, marginBottom: 3, fontFamily: fonts.sans }}>Produit</div>
          <div style={{ position: 'relative' }}>
            <input
              value={prodQuery}
              onChange={e => { setProdQuery(e.target.value); if (product) clearProduct() }}
              onFocus={() => { if (prodResults.length > 0) setShowDrop(true) }}
              placeholder="Rechercher…"
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
          <div style={{ fontSize: 11, color: colors.textMd, marginBottom: 3, fontFamily: fonts.sans }}>Entrepôt</div>
          <Select
            value={warehouseId}
            onChange={setWarehouseId}
            placeholder="Tous"
            options={warehouses.map(w => ({ value: w.id, label: w.name }))}
          />
        </div>

        {/* Operation type */}
        <div style={{ width: 150 }}>
          <div style={{ fontSize: 11, color: colors.textMd, marginBottom: 3, fontFamily: fonts.sans }}>Opération</div>
          <Select
            value={opFilter}
            onChange={setOpFilter}
            placeholder="Toutes"
            options={[
              { value: 'add',     label: 'Ajouter'  },
              { value: 'remove',  label: 'Retirer'  },
              { value: 'correct', label: 'Corriger' },
            ]}
          />
        </div>

        {/* Date from */}
        <div>
          <div style={{ fontSize: 11, color: colors.textMd, marginBottom: 3, fontFamily: fonts.sans }}>Du</div>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ ...inputStyle, width: 140 }}
          />
        </div>

        {/* Date to */}
        <div>
          <div style={{ fontSize: 11, color: colors.textMd, marginBottom: 3, fontFamily: fonts.sans }}>Au</div>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ ...inputStyle, width: 140 }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 0, alignSelf: 'flex-end' }}>
          <button
            onClick={applyFilters}
            style={{
              padding: '6px 14px', borderRadius: 4, fontSize: 13, fontFamily: fonts.sans,
              background: colors.primary, color: '#fff',
              border: `1px solid ${colors.primary}`, cursor: 'pointer', fontWeight: 500,
            }}
          >
            Filtrer
          </button>
          <button
            onClick={resetFilters}
            style={{
              padding: '6px 12px', borderRadius: 4, fontSize: 13, fontFamily: fonts.sans,
              background: '#fff', color: colors.textMd,
              border: `1px solid ${colors.border}`, cursor: 'pointer',
            }}
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: '16px' }}>
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyText="Aucun mouvement de stock trouvé."
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
