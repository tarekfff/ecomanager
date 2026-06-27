'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { PageHeader, Table } from '@/components/ui'
import type { Column } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────────

interface StockAlert {
  product_id:     string
  tenant_id:      string
  name:           string
  sku:            string | null
  current_stock:  number
  stock_alert_min: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHdr() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AlertesPage() {
  const router = useRouter()
  const [items,   setItems]   = useState<StockAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const fetchData = useCallback(() => {
    setLoading(true)
    setError('')
    fetch('/api/stock/alerts', { headers: authHdr() })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) setItems(d)
        else setError(d.error ?? 'Erreur lors du chargement.')
      })
      .catch(() => setError('Erreur réseau.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const columns: Column<StockAlert>[] = [
    {
      key: 'name', label: 'Produit',
      render: r => <span style={{ fontWeight: 500 }}>{r.name}</span>,
    },
    {
      key: 'sku', label: 'SKU', width: 130,
      render: r => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: colors.textMd }}>
          {r.sku ?? '—'}
        </span>
      ),
    },
    {
      key: 'current_stock', label: 'Stock actuel', width: 120,
      render: r => (
        <span style={{ fontWeight: 700, color: colors.red, fontSize: 13 }}>
          {r.current_stock}
        </span>
      ),
    },
    {
      key: 'stock_alert_min', label: 'Stock minimum', width: 130,
      render: r => (
        <span style={{ color: colors.textMd, fontSize: 13 }}>
          {r.stock_alert_min}
        </span>
      ),
    },
    {
      key: '_ecart', label: 'Écart', width: 100,
      render: r => {
        const diff = r.current_stock - r.stock_alert_min
        return (
          <span style={{ fontWeight: 600, color: colors.red }}>
            {diff}
          </span>
        )
      },
    },
    {
      key: '_action', label: 'Action', width: 130,
      render: r => (
        <button
          onClick={() => router.push(`/dashboard/stock/ajustement?product_id=${r.product_id}`)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 4, fontSize: 12,
            fontFamily: fonts.sans, cursor: 'pointer', fontWeight: 500,
            background: colors.primaryLt, color: colors.primary,
            border: `1px solid ${colors.primary}`,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = colors.primary) && (e.currentTarget.style.color = '#fff') as unknown as boolean}
          onMouseLeave={e => { e.currentTarget.style.background = colors.primaryLt; e.currentTarget.style.color = colors.primary }}
        >
          Ajuster
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Alertes de stock"
        subtitle="Produits dont le stock est en dessous du seuil minimum configuré."
      />

      {error && (
        <div style={{
          margin: 16, padding: '10px 14px', borderRadius: 5,
          background: '#f8d7da', border: '1px solid #f5c2c7',
          color: '#842029', fontSize: 13, fontFamily: fonts.sans,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={{
          margin: 24, padding: '32px 20px', textAlign: 'center',
          background: '#fff', border: `1px solid ${colors.border}`,
          borderRadius: 8, fontFamily: fonts.sans,
        }}>
          <div style={{ color: colors.green, marginBottom: 8 }}>
            <AlertTriangle size={32} strokeWidth={1.5} style={{ display: 'inline-block' }} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
            Aucune alerte de stock
          </div>
          <div style={{ fontSize: 13, color: colors.textMd, marginTop: 4 }}>
            Tous les produits sont au-dessus de leur seuil minimum.
          </div>
        </div>
      )}

      {(loading || items.length > 0) && (
        <div style={{ padding: '16px' }}>
          <Table
            columns={columns}
            data={items}
            loading={loading}
            emptyText="Aucune alerte de stock."
          />
          {!loading && (
            <div style={{
              marginTop: 10, fontSize: 12, color: colors.textMd, fontFamily: fonts.sans,
            }}>
              {items.length} produit{items.length !== 1 ? 's' : ''} en alerte
            </div>
          )}
        </div>
      )}
    </>
  )
}
