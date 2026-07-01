'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Package } from 'lucide-react'
import {
  PageHeader, Table, Pagination, Button,
  Badge, SearchInput, Select, ConfirmDialog,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'
import { useBoutique } from '@/contexts/BoutiqueContext'

// ── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id:            string
  name:          string
  sku:           string | null
  price:         number
  compare_price: number | null
  is_active:     boolean
  brand_name:    string | null
  stock_total:   number
  created_at:    string
}

interface Boutique { id: string; name: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const LIMIT = 25

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function formatPrice(n: number) {
  return n.toLocaleString('fr-DZ') + ' DA'
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const router              = useRouter()
  const { boutiqueId }      = useBoutique()
  const { t }               = useTranslation('products')

  const STATUS_OPTIONS = [
    { value: 'true',  label: t('status.active') },
    { value: 'false', label: t('status.inactive') },
  ]

  const [products,        setProducts]        = useState<Product[]>([])
  const [total,           setTotal]           = useState(0)
  const [page,            setPage]            = useState(1)
  const [search,          setSearch]          = useState('')
  const [dbSearch,        setDbSearch]        = useState('')
  const [loading,         setLoading]         = useState(false)
  const [statusFilter,    setStatusFilter]    = useState('')
  const [boutiqueFilter,  setBoutiqueFilter]  = useState('')
  const [boutiques,       setBoutiques]       = useState<Boutique[]>([])
  const [deleteTarget,    setDeleteTarget]    = useState<Product | null>(null)
  const [deleting,        setDeleting]        = useState(false)

  // Seed boutique filter from context once it resolves
  useEffect(() => {
    if (boutiqueId && !boutiqueFilter) setBoutiqueFilter(boutiqueId)
  }, [boutiqueId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load boutique list for the filter selector
  useEffect(() => {
    fetch('/api/boutiques', { headers: authHeader() })
      .then(r => r.json())
      .then((data: Boutique[]) => { if (Array.isArray(data)) setBoutiques(data) })
      .catch(() => {})
  }, [])

  // ── Debounce search ──────────────────────────────────────────────────────

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(val: string) {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDbSearch(val); setPage(1) }, 300)
  }

  function handleStatusChange(val: string)   { setStatusFilter(val);   setPage(1) }
  function handleBoutiqueChange(val: string) { setBoutiqueFilter(val); setPage(1) }

  // ── Fetch products ────────────────────────────────────────────────────────

  const fetchProducts = useCallback(() => {
    const bid = boutiqueFilter || boutiqueId
    if (!bid) return

    setLoading(true)
    const qs = new URLSearchParams({
      page:        String(page),
      limit:       String(LIMIT),
      search:      dbSearch,
      boutique_id: bid,
    })
    if (statusFilter) qs.set('is_active', statusFilter)

    fetch(`/api/products?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => { setProducts(d.items ?? []); setTotal(d.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, dbSearch, statusFilter, boutiqueFilter, boutiqueId])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  // ── Soft delete ───────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body:    JSON.stringify({ deleted_at: new Date().toISOString() }),
      })
      if (res.ok) { setDeleteTarget(null); fetchProducts() }
    } finally {
      setDeleting(false)
    }
  }

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns: Column<Product>[] = [
    {
      key: 'image', label: '', width: 48,
      render: () => (
        <div style={{
          width: 32, height: 32, borderRadius: 4,
          background: '#f5eef5', border: `1px solid ${colors.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Package size={14} color={colors.textLt} />
        </div>
      ),
    },
    {
      key: 'name', label: t('table.name'),
      render: row => (
        <span style={{ fontWeight: 500, color: colors.text, fontFamily: fonts.sans }}>
          {row.name}
        </span>
      ),
    },
    {
      key: 'sku', label: t('table.sku'), width: 140,
      render: row => (
        <span style={{ color: colors.textMd, fontSize: 12, fontFamily: 'monospace' }}>
          {row.sku ?? '—'}
        </span>
      ),
    },
    {
      key: 'price', label: t('table.price'), width: 140,
      render: row => (
        <span style={{ fontWeight: 500, color: colors.text, fontFamily: fonts.sans }}>
          {formatPrice(row.price)}
        </span>
      ),
    },
    {
      key: 'stock_total', label: t('table.stock'), width: 90,
      render: row => (
        <span style={{
          fontWeight: 600, fontFamily: fonts.sans,
          color: row.stock_total === 0 ? colors.red : colors.text,
        }}>
          {row.stock_total}
        </span>
      ),
    },
    {
      key: 'brand_name', label: t('table.brand'), width: 140,
      render: row => (
        <span style={{
          fontSize: 12, fontFamily: fonts.sans,
          color: row.brand_name ? colors.textMd : colors.textLt,
        }}>
          {row.brand_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'is_active', label: t('table.status'), width: 90,
      render: row => (
        <Badge color={row.is_active ? 'green' : 'red'}>
          {row.is_active ? t('status.active') : t('status.inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions', label: t('table.actions'), width: 120,
      render: row => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => router.push(`/dashboard/products/${row.id}/edit`)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11.5, padding: '3px 8px', borderRadius: 3,
              border: `1px solid ${colors.border}`,
              background: '#fff', color: colors.textMd,
              cursor: 'pointer', fontFamily: fonts.sans,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <Pencil size={11} /> {t('common:actions.edit')}
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 3,
              border: '1px solid #f5c6cb', background: '#fff8f8',
              color: colors.red, cursor: 'pointer',
            }}
            title={t('trash.title')}
            onMouseEnter={e => (e.currentTarget.style.background = '#fde8ea')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff8f8')}
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ]

  const boutiqueOptions = boutiques.map(b => ({ value: b.id, label: b.name }))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/dashboard/products/import')}
            >
              {t('import')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/dashboard/products/new')}
            >
              {t('addProduct')}
            </Button>
          </div>
        }
      />

      <div style={{
        flex: 1, overflow: 'auto', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>

        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder={t('searchPlaceholder')}
          />
          <div style={{ width: 160, flexShrink: 0 }}>
            <Select
              value={statusFilter}
              onChange={handleStatusChange}
              options={STATUS_OPTIONS}
              placeholder={t('status.all')}
            />
          </div>
          {boutiques.length > 1 && (
            <div style={{ width: 190, flexShrink: 0 }}>
              <Select
                value={boutiqueFilter}
                onChange={handleBoutiqueChange}
                options={boutiqueOptions}
                placeholder={t('boutiquePlaceholder')}
              />
            </div>
          )}
          <span style={{
            fontSize: 12, color: colors.textMd,
            fontFamily: fonts.sans, marginLeft: 'auto', flexShrink: 0,
          }}>
            {loading ? '…' : t('count', { count: total })}
          </span>
        </div>

        <Table<Product>
          columns={columns}
          data={products}
          loading={loading}
          emptyText={t('empty')}
        />

        {total > LIMIT && (
          <Pagination
            page={page}
            total={total}
            limit={LIMIT}
            onChange={p => setPage(p)}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('trash.title')}
        message={t('trash.message', { name: deleteTarget?.name ?? '' })}
        confirmLabel={deleting ? t('trash.moving') : t('trash.title')}
        danger
      />
    </>
  )
}
