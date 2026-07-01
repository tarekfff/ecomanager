'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useBoutique } from '@/contexts/BoutiqueContext'
import { colors, fonts } from '@/lib/tokens'
import { ChevronDown, ChevronRight, CheckCircle, RotateCcw, ArrowLeftRight, Loader2 } from 'lucide-react'

interface ReceiptRow {
  id:           string
  order_id:     string
  carrier_id:   string | null
  amount:       number
  created_at:   string
  reference:    string
  client_name:  string
  carrier_name: string
}

interface CarrierGroup {
  carrier_id:   string | null
  carrier_name: string
  receipts:     ReceiptRow[]
  total:        number
}

function fmt(n: number) {
  return n.toLocaleString('fr-DZ') + ' DA'
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function BonRetourPage() {
  const { boutiqueId } = useBoutique()
  const { t } = useTranslation('orders')
  const [groups,  setGroups]  = useState<CarrierGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [confirming, setConfirming] = useState<Record<string, boolean>>({})
  const [goingBack,  setGoingBack]  = useState<Record<string, boolean>>({})

  const boutiqueIdRef = useRef(boutiqueId)
  useEffect(() => { boutiqueIdRef.current = boutiqueId }, [boutiqueId])

  function auth(): Record<string, string> {
    return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
  }

  const fetchReceipts = useCallback(() => {
    const bid = boutiqueIdRef.current
    if (!bid) return
    setLoading(true)
    fetch(`/api/receipts?type=retour&boutique_id=${bid}&status=pending`, {
      headers: auth(),
    })
      .then(r => r.json())
      .then((rows: ReceiptRow[]) => {
        const map = new Map<string, CarrierGroup>()
        for (const row of (Array.isArray(rows) ? rows : [])) {
          const key = row.carrier_id ?? '__none__'
          if (!map.has(key)) {
            map.set(key, {
              carrier_id:   row.carrier_id,
              carrier_name: row.carrier_name || '',
              receipts:     [],
              total:        0,
            })
          }
          const grp = map.get(key)!
          grp.receipts.push(row)
          grp.total += row.amount
        }
        const grps = Array.from(map.values())
        setGroups(grps)
        setExpanded(prev => {
          const next: Record<string, boolean> = {}
          grps.forEach(g => {
            const key = g.carrier_id ?? '__none__'
            next[key] = prev[key] !== false
          })
          return next
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (boutiqueId) fetchReceipts() }, [boutiqueId, fetchReceipts])

  async function confirmGroup(group: CarrierGroup) {
    const key = group.carrier_id ?? '__none__'
    setConfirming(p => ({ ...p, [key]: true }))
    try {
      const res = await fetch('/api/receipts/bulk-confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...auth() },
        body:    JSON.stringify({
          carrier_id: group.carrier_id,
          type:       'retour',
          order_ids:  group.receipts.map(r => r.order_id),
        }),
      })
      if (res.ok) fetchReceipts()
    } finally {
      setConfirming(p => ({ ...p, [key]: false }))
    }
  }

  async function goBack(row: ReceiptRow) {
    setGoingBack(p => ({ ...p, [row.id]: true }))
    try {
      await Promise.all([
        fetch(`/api/orders/${row.order_id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', ...auth() },
          body:    JSON.stringify({ action: 'go_back_to_livraison' }),
        }),
        fetch(`/api/receipts/${row.id}`, { method: 'DELETE', headers: auth() }),
      ])
      fetchReceipts()
    } finally {
      setGoingBack(p => ({ ...p, [row.id]: false }))
    }
  }

  const totalPending = groups.reduce((s, g) => s + g.total, 0)
  const countPending = groups.reduce((s, g) => s + g.receipts.length, 0)

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: 24,
      fontFamily: fonts.sans, background: colors.bg,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ArrowLeftRight size={18} color={colors.primary} strokeWidth={1.8} />
          <h1 style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: 0 }}>
            {t('bonRetour.title')}
          </h1>
        </div>
        {!loading && countPending > 0 && (
          <span style={{ fontSize: 12, color: colors.textMd }}>
            {t('bonRetour.subtitle', { count: countPending })}
            {totalPending > 0 && ` · ${fmt(totalPending)}`}
          </span>
        )}
      </div>
      <div style={{ height: 1, background: colors.border, marginBottom: 20 }} />

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: colors.textLt, fontSize: 13, padding: '40px 0' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          {t('loading')}
        </div>
      )}

      {/* Empty */}
      {!loading && groups.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 0',
          color: colors.textLt, fontSize: 14,
        }}>
          <ArrowLeftRight size={32} color={colors.border} style={{ marginBottom: 12 }} />
          <div>{t('bonRetour.empty')}</div>
        </div>
      )}

      {/* Carrier accordion groups */}
      {!loading && groups.map(group => {
        const key      = group.carrier_id ?? '__none__'
        const isOpen   = expanded[key] !== false
        const isConfirming = !!confirming[key]

        return (
          <div
            key={key}
            style={{
              background: '#fff',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              marginBottom: 12,
              overflow: 'hidden',
            }}
          >
            {/* Group header */}
            <div
              style={{
                display: 'flex', alignItems: 'center',
                padding: '12px 16px',
                background: '#FAFAFA',
                borderBottom: isOpen ? `1px solid ${colors.border}` : 'none',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => setExpanded(p => ({ ...p, [key]: !isOpen }))}
            >
              <span style={{ color: colors.textLt, marginRight: 8, flexShrink: 0 }}>
                {isOpen
                  ? <ChevronDown  size={14} />
                  : <ChevronRight size={14} />
                }
              </span>
              <span style={{ fontWeight: 600, fontSize: 13.5, color: colors.text, flex: 1 }}>
                {group.carrier_name || t('bonRetour.noCarrier')}
              </span>
              <span style={{ fontSize: 12, color: colors.textMd, marginRight: 16 }}>
                {t('bonRetour.receipts', { count: group.receipts.length })}
              </span>
              {group.total > 0 && (
                <span style={{
                  fontWeight: 700, fontSize: 14, color: colors.primary,
                  marginRight: 16,
                }}>
                  {fmt(group.total)}
                </span>
              )}
              <button
                onClick={e => { e.stopPropagation(); confirmGroup(group) }}
                disabled={isConfirming}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 6,
                  border: 'none', cursor: isConfirming ? 'not-allowed' : 'pointer',
                  background: isConfirming ? '#ccc' : colors.primary,
                  color: '#fff', fontSize: 12.5, fontWeight: 600,
                  fontFamily: fonts.sans,
                  transition: 'background .15s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  if (!isConfirming) (e.currentTarget as HTMLButtonElement).style.background = colors.primaryDk
                }}
                onMouseLeave={e => {
                  if (!isConfirming) (e.currentTarget as HTMLButtonElement).style.background = colors.primary
                }}
              >
                <CheckCircle size={13} strokeWidth={2} />
                {isConfirming ? t('bonRetour.confirmingBtn') : t('bonRetour.confirmBtn')}
              </button>
            </div>

            {/* Rows */}
            {isOpen && (
              <div>
                {/* Column headers */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 130px 120px',
                  padding: '7px 16px',
                  fontSize: 11, fontWeight: 600, color: colors.textLt,
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                  borderBottom: `1px solid ${colors.border}`,
                  background: '#FEFEFE',
                }}>
                  <span>{t('bonRetour.colRef')}</span>
                  <span>{t('bonRetour.colClient')}</span>
                  <span style={{ textAlign: 'right' }}>{t('bonRetour.colAmount')}</span>
                  <span style={{ textAlign: 'right' }}>{t('bonRetour.colActions')}</span>
                </div>

                {group.receipts.map((row, idx) => (
                  <div
                    key={row.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr 130px 120px',
                      padding: '10px 16px',
                      alignItems: 'center',
                      borderBottom: idx < group.receipts.length - 1 ? `1px solid ${colors.border}` : 'none',
                      background: '#fff',
                    }}
                  >
                    <span style={{
                      fontSize: 12.5, fontWeight: 600,
                      color: colors.primary, fontFamily: 'monospace',
                    }}>
                      {row.reference}
                    </span>
                    <span style={{ fontSize: 13, color: colors.text }}>
                      {row.client_name || '—'}
                      <span style={{ fontSize: 11, color: colors.textLt, marginLeft: 6 }}>
                        {formatDate(row.created_at)}
                      </span>
                    </span>
                    <span style={{
                      textAlign: 'right', fontWeight: 600,
                      fontSize: 13.5, color: colors.text,
                    }}>
                      {row.amount > 0 ? fmt(row.amount) : '—'}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => goBack(row)}
                        disabled={!!goingBack[row.id]}
                        title={t('bonRetour.backDeliveryTitle')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 10px', borderRadius: 5,
                          border: `1px solid ${colors.border}`,
                          background: '#fff', cursor: goingBack[row.id] ? 'not-allowed' : 'pointer',
                          fontSize: 12, color: colors.textMd,
                          fontFamily: fonts.sans,
                          transition: 'border-color .12s, color .12s',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = colors.orange
                          ;(e.currentTarget as HTMLButtonElement).style.color = colors.orange
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border
                          ;(e.currentTarget as HTMLButtonElement).style.color = colors.textMd
                        }}
                      >
                        <RotateCcw size={11} strokeWidth={2} />
                        {goingBack[row.id] ? '…' : t('bonRetour.backDelivery')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
