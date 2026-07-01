'use client'
import { useState, useEffect } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader, Select, Button } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────

type ExportType = 'orders' | 'clients' | 'products' | 'stock' | 'bilan'
type Format     = 'xlsx' | 'csv'

interface Boutique       { id: string; name: string; prefix: string }
interface TrackingStatus { id: string; name: string; slug: string }

const SUPPORTS_STATUS = (t: ExportType) => t === 'orders'
const SUPPORTS_DATES  = (t: ExportType) => t === 'orders' || t === 'clients' || t === 'bilan'

// ── Helpers ────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ExportPage() {
  const { t } = useTranslation('accounting')
  const [type,        setType]        = useState<ExportType>('orders')
  const [boutiqueId,  setBoutiqueId]  = useState('')
  const [statuses,    setStatuses]    = useState<string[]>([])
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [format,      setFormat]      = useState<Format>('xlsx')
  const [boutiques,       setBoutiques]       = useState<Boutique[]>([])
  const [trackingStatuses, setTrackingStatuses] = useState<TrackingStatus[]>([])
  const [generating, setGenerating] = useState(false)
  const [error,      setError]      = useState('')

  const TYPE_OPTIONS: { value: ExportType; label: string }[] = [
    { value: 'orders',   label: t('export.types.orders')   },
    { value: 'clients',  label: t('export.types.clients')  },
    { value: 'products', label: t('export.types.products') },
    { value: 'stock',    label: t('export.types.stock')    },
    { value: 'bilan',    label: t('export.types.bilan')    },
  ]

  useEffect(() => {
    fetch('/api/boutiques', { headers: authHeader() })
      .then(r => r.json())
      .then((d: Boutique[]) => { if (Array.isArray(d)) setBoutiques(d) })
      .catch(() => {})

    fetch('/api/config/tracking-statuses', { headers: authHeader() })
      .then(r => r.json())
      .then((d: TrackingStatus[]) => { if (Array.isArray(d)) setTrackingStatuses(d) })
      .catch(() => {})
  }, [])

  function toggleStatus(slug: string) {
    setStatuses(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug],
    )
  }

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/donnees/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          type,
          boutique_id: boutiqueId || null,
          filters: {
            statuses: SUPPORTS_STATUS(type) ? statuses : [],
            dateFrom: SUPPORTS_DATES(type) ? (dateFrom || null) : null,
            dateTo:   SUPPORTS_DATES(type) ? (dateTo   || null) : null,
          },
          format,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError((err as { error?: string }).error ?? t('export.errGenerate'))
        return
      }

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match?.[1] ?? `export_${type}.${format}`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError(t('export.errNetwork'))
    } finally {
      setGenerating(false)
    }
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 12.5, color: colors.textMd, marginBottom: 4,
    fontWeight: 500, fontFamily: fonts.sans, display: 'block',
  }

  const dateInputStyle: React.CSSProperties = {
    width: '100%', border: `1px solid ${colors.border}`, borderRadius: 4,
    padding: '7px 10px', fontSize: 13, color: colors.text,
    fontFamily: fonts.sans, outline: 'none', boxSizing: 'border-box', background: '#fff',
  }

  return (
    <>
      <PageHeader title={t('export.title')} subtitle={t('export.subtitle')} />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div style={{
          maxWidth: 620, background: '#fff', border: `1px solid ${colors.border}`,
          borderRadius: 8, padding: 20,
          display: 'flex', flexDirection: 'column', gap: 16,
          fontFamily: fonts.sans,
        }}>
          <Select
            label={t('export.typeLabel')}
            value={type}
            onChange={v => { setType(v as ExportType); setStatuses([]) }}
            options={TYPE_OPTIONS}
          />

          <Select
            label={t('export.boutiqueLabel')}
            value={boutiqueId}
            onChange={setBoutiqueId}
            placeholder={t('export.allBoutiques')}
            options={[
              { value: '', label: t('export.allBoutiques') },
              ...boutiques.map(b => ({ value: b.id, label: b.name })),
            ]}
          />

          {SUPPORTS_STATUS(type) && (
            <div>
              <span style={labelStyle}>{t('export.statusLabel')}</span>
              {trackingStatuses.length === 0 ? (
                <span style={{ fontSize: 12, color: colors.textLt }}>{t('export.loadingStatuses')}</span>
              ) : (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6,
                  padding: 10, border: `1px solid ${colors.border}`,
                  borderRadius: 5, background: '#fafafa',
                }}>
                  {trackingStatuses.map(s => {
                    const active = statuses.includes(s.slug)
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggleStatus(s.slug)}
                        style={{
                          fontSize: 12, padding: '4px 10px', borderRadius: 14,
                          cursor: 'pointer', fontFamily: fonts.sans,
                          border: `1px solid ${active ? colors.primary : colors.border}`,
                          background: active ? colors.primaryLt : '#fff',
                          color: active ? colors.primary : colors.textMd,
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {s.name}
                      </button>
                    )
                  })}
                </div>
              )}
              <span style={{ fontSize: 11, color: colors.textLt, marginTop: 4, display: 'block' }}>
                {statuses.length === 0
                  ? t('export.noStatusFilter')
                  : t('export.statusCount', { count: statuses.length })}
              </span>
            </div>
          )}

          {SUPPORTS_DATES(type) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <span style={labelStyle}>{t('export.dateFrom')}</span>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateInputStyle} />
              </div>
              <div>
                <span style={labelStyle}>{t('export.dateTo')}</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateInputStyle} />
              </div>
            </div>
          )}

          <div>
            <span style={labelStyle}>{t('export.formatLabel')}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {([
                { value: 'xlsx' as const, label: t('export.xlsx'), icon: FileSpreadsheet },
                { value: 'csv'  as const, label: t('export.csv'),  icon: FileText },
              ]).map(opt => {
                const active = format === opt.value
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                      fontFamily: fonts.sans, fontSize: 13,
                      border: `1px solid ${active ? colors.primary : colors.border}`,
                      background: active ? colors.primaryLt : '#fff',
                      color: active ? colors.primary : colors.textMd,
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${active ? colors.primary : colors.border}`,
                      background: active ? colors.primary : '#fff',
                      boxShadow: active ? `inset 0 0 0 2px #fff` : 'none',
                    }} />
                    <Icon size={15} />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {error && <p style={{ fontSize: 12.5, color: colors.red, margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
            <Button variant="primary" loading={generating} onClick={handleGenerate}>
              <Download size={14} /> {t('export.generateBtn')}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
