'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { colors, fonts } from '@/lib/tokens'
import { PageHeader } from '@/components/ui'

// ── Types ────────────────────────────────────────────────────────────────────

interface Boutique    { id: string; name: string }
interface ProductHit { id: string; name: string; sku: string | null }
interface Variant    { id: string; sku: string | null }

interface RentaResult {
  benefice_total:    number
  qte_livree:        number
  benefice_unitaire: number
  cout_pub_unitaire: number
  roi:               number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

const todayStr     = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-DZ') + ' DA'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RentabilitePage() {
  const { t } = useTranslation('accounting')
  const [boutiques,  setBoutiques]  = useState<Boutique[]>([])
  const [boutiqueId, setBoutiqueId] = useState('')
  const [from,       setFrom]       = useState(firstOfMonth())
  const [to,         setTo]         = useState(todayStr())

  const [prodQuery,  setProdQuery]  = useState('')
  const [prodHits,   setProdHits]   = useState<ProductHit[]>([])
  const [showHits,   setShowHits]   = useState(false)
  const [product,    setProduct]    = useState<ProductHit | null>(null)

  const [variants,   setVariants]   = useState<Variant[]>([])
  const [variantId,  setVariantId]  = useState('')

  const [splitRemise,   setSplitRemise]   = useState(true)
  const [splitLivr,     setSplitLivr]     = useState(true)
  const [splitLivreurs, setSplitLivreurs] = useState(true)
  const [splitConf,     setSplitConf]     = useState(true)
  const [splitEmb,      setSplitEmb]      = useState(true)

  const [result,  setResult]  = useState<RentaResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/boutiques', { headers: authHeader() })
      .then(r => r.json())
      .then((d: Boutique[]) => { if (Array.isArray(d)) setBoutiques(d) })
      .catch(() => {})
  }, [])

  function handleProdQuery(val: string) {
    setProdQuery(val)
    setProduct(null)
    setVariants([])
    setVariantId('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setProdHits([]); setShowHits(false); return }
    debounceRef.current = setTimeout(() => {
      const qs = new URLSearchParams({ search: val.trim(), limit: '10' })
      fetch(`/api/products?${qs}`, { headers: authHeader() })
        .then(r => r.json())
        .then((d: { items?: ProductHit[] }) => { setProdHits(d.items ?? []); setShowHits(true) })
        .catch(() => {})
    }, 300)
  }

  function pickProduct(p: ProductHit) {
    setProduct(p)
    setProdQuery(p.name)
    setShowHits(false)
    setVariantId('')
    fetch(`/api/products/${p.id}`, { headers: authHeader() })
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((d: any) => { const vs = (d?.product_variants ?? []) as Variant[]; setVariants(vs) })
      .catch(() => setVariants([]))
  }

  const fetchRenta = useCallback(() => {
    if (!product)     { setError(t('rentabilite.errProduct')); return }
    if (!from || !to) { setError(t('rentabilite.errPeriod'));  return }
    setError('')
    setLoading(true)
    const qs = new URLSearchParams({
      product_id: product.id,
      from, to,
      split_remise:       String(splitRemise),
      split_livraison:    String(splitLivr),
      split_livreurs:     String(splitLivreurs),
      split_confirmation: String(splitConf),
      split_emballage:    String(splitEmb),
    })
    if (variantId)  qs.set('variant_id', variantId)
    if (boutiqueId) qs.set('boutique_id', boutiqueId)

    fetch(`/api/comptabilite/rentabilite?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then((d: RentaResult & { error?: string }) => {
        if (d.error) { setError(d.error); setResult(null); return }
        setResult(d)
      })
      .catch(() => setError(t('rentabilite.errNetwork')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, variantId, boutiqueId, from, to, splitRemise, splitLivr, splitLivreurs, splitConf, splitEmb, t])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.bg, fontFamily: fonts.sans }}>
      <PageHeader title={t('rentabilite.title')} subtitle={t('rentabilite.subtitle')} />

      <div style={{ background: '#fff', borderBottom: `1px solid ${colors.border}`, padding: '10px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>

          <div style={{ minWidth: 240, position: 'relative' }}>
            <div style={labelSt}>{t('rentabilite.filters.product')}</div>
            <input
              value={prodQuery}
              onChange={e => handleProdQuery(e.target.value)}
              onFocus={() => { if (prodHits.length) setShowHits(true) }}
              placeholder={t('rentabilite.filters.productPh')}
              style={{ ...inputSt, width: '100%' }}
            />
            {showHits && prodHits.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                background: '#fff', border: `1px solid ${colors.border}`,
                borderRadius: 4, marginTop: 2, maxHeight: 240, overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
              }}>
                {prodHits.map(p => (
                  <div
                    key={p.id}
                    onClick={() => pickProduct(p)}
                    style={{ padding: '7px 10px', fontSize: 12.5, cursor: 'pointer', borderBottom: `1px solid ${colors.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = colors.primaryLt)}
                    onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                  >
                    <span style={{ color: colors.text }}>{p.name}</span>
                    {p.sku && <span style={{ color: colors.textLt, marginLeft: 6 }}>({p.sku})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ minWidth: 170 }}>
            <div style={labelSt}>{t('rentabilite.filters.variant')}</div>
            <select value={variantId} onChange={e => setVariantId(e.target.value)} disabled={variants.length === 0} style={{ ...selSt, opacity: variants.length === 0 ? 0.6 : 1 }}>
              <option value="">{t('rentabilite.filters.allVariants')}</option>
              {variants.map(v => <option key={v.id} value={v.id}>{v.sku ?? v.id.slice(0, 8)}</option>)}
            </select>
          </div>

          <div style={{ minWidth: 160 }}>
            <div style={labelSt}>{t('rentabilite.filters.boutique')}</div>
            <select value={boutiqueId} onChange={e => setBoutiqueId(e.target.value)} style={selSt}>
              <option value="">{t('rentabilite.filters.allBoutiques')}</option>
              {boutiques.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div>
              <div style={labelSt}>{t('rentabilite.filters.periodFrom')}</div>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputSt} />
            </div>
            <span style={{ fontSize: 12, color: colors.textLt, paddingBottom: 8 }}>–</span>
            <div>
              <div style={labelSt}>{t('rentabilite.filters.to')}</div>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputSt} />
            </div>
          </div>

          <button
            onClick={fetchRenta}
            disabled={loading}
            style={{
              background: loading ? colors.primaryLt : colors.primary,
              color: loading ? colors.primary : '#fff',
              border: 'none', borderRadius: 5, padding: '7px 20px',
              fontSize: 13, fontFamily: fonts.sans, fontWeight: 600,
              cursor: loading ? 'default' : 'pointer', alignSelf: 'flex-end',
            }}
          >
            {loading ? t('rentabilite.filters.calcLoading') : t('rentabilite.filters.calcBtn')}
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 12 }}>
          <Toggle label={t('rentabilite.toggles.remise')}      value={splitRemise}   onChange={setSplitRemise}   yesLabel={t('rentabilite.toggles.yes')} noLabel={t('rentabilite.toggles.no')} />
          <Toggle label={t('rentabilite.toggles.livraison')}   value={splitLivr}     onChange={setSplitLivr}     yesLabel={t('rentabilite.toggles.yes')} noLabel={t('rentabilite.toggles.no')} />
          <Toggle label={t('rentabilite.toggles.livreurs')}    value={splitLivreurs} onChange={setSplitLivreurs} yesLabel={t('rentabilite.toggles.yes')} noLabel={t('rentabilite.toggles.no')} />
          <Toggle label={t('rentabilite.toggles.confirmation')} value={splitConf}    onChange={setSplitConf}     yesLabel={t('rentabilite.toggles.yes')} noLabel={t('rentabilite.toggles.no')} />
          <Toggle label={t('rentabilite.toggles.emballage')}   value={splitEmb}      onChange={setSplitEmb}      yesLabel={t('rentabilite.toggles.yes')} noLabel={t('rentabilite.toggles.no')} />
        </div>
        <div style={{ fontSize: 11, color: colors.textLt, marginTop: 4 }}>
          {t('rentabilite.toggles.hint')}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>

        {error && (
          <div style={{ background: '#fff3f3', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!result && !loading && !error && (
          <div style={{ textAlign: 'center', color: colors.textLt, fontSize: 13, paddingTop: 60 }}>
            {t('rentabilite.prompt')}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', color: colors.textLt, fontSize: 13, paddingTop: 60 }}>{t('rentabilite.loading')}</div>
        )}

        {result && !loading && (
          <div style={{ maxWidth: 720 }}>
            <div style={{
              background: result.benefice_total >= 0 ? '#F0FDF4' : '#FFF1F2',
              border: `2px solid ${result.benefice_total >= 0 ? '#16A34A' : '#E11D48'}`,
              borderRadius: 10, padding: '22px 24px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.textMd, marginBottom: 6 }}>
                {t('rentabilite.result.beneficeTitle')}{product ? ` — ${product.name}` : ''}
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, color: result.benefice_total >= 0 ? '#16A34A' : '#E11D48' }}>
                {result.benefice_total >= 0 ? '+' : ''}{fmt(result.benefice_total)}
              </div>
              <div style={{ fontSize: 12, color: colors.textLt, marginTop: 4 }}>
                {t('rentabilite.result.unitsDelivered', { count: result.qte_livree })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <MetricCard label={t('rentabilite.result.beneficeUnit')} value={fmt(result.benefice_unitaire)}
                color={result.benefice_unitaire >= 0 ? colors.green : colors.red} />
              <MetricCard label={t('rentabilite.result.coutPub')} value={fmt(result.cout_pub_unitaire)}
                color={colors.text} />
              <MetricCard label={t('rentabilite.result.roi')} value={`${result.roi >= 0 ? '+' : ''}${result.roi.toFixed(1)} %`}
                color={result.roi >= 0 ? colors.green : colors.red} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({ label, value, onChange, yesLabel, noLabel }: {
  label: string; value: boolean; onChange: (v: boolean) => void; yesLabel: string; noLabel: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: colors.textMd }}>{label}</span>
      <div style={{ display: 'flex', border: `1px solid ${colors.border}`, borderRadius: 5, overflow: 'hidden' }}>
        {([[yesLabel, true], [noLabel, false]] as [string, boolean][]).map(([lbl, val]) => (
          <button
            key={lbl}
            onClick={() => onChange(val)}
            style={{
              border: 'none', padding: '4px 12px', fontSize: 12, cursor: 'pointer',
              fontFamily: fonts.sans, fontWeight: value === val ? 600 : 400,
              background: value === val ? colors.primary : '#fff',
              color: value === val ? '#fff' : colors.textMd,
            }}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: '1 1 180px', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '16px 18px' }}>
      <div style={{ fontSize: 12, color: colors.textMd, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 11, color: colors.textMd, marginBottom: 3, fontWeight: 500,
}
const selSt: React.CSSProperties = {
  border: `1px solid ${colors.border}`, borderRadius: 4, padding: '6px 8px', fontSize: 12.5,
  fontFamily: fonts.sans, color: colors.text, background: '#fff', outline: 'none', cursor: 'pointer', width: '100%',
}
const inputSt: React.CSSProperties = {
  border: `1px solid ${colors.border}`, borderRadius: 4, padding: '6px 8px', fontSize: 12.5,
  fontFamily: fonts.sans, color: colors.text, background: '#fff', outline: 'none',
}
