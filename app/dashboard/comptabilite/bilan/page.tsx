'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { colors, fonts } from '@/lib/tokens'
import { PageHeader } from '@/components/ui'

// ── Types ────────────────────────────────────────────────────────────────────

interface Boutique { id: string; name: string }

interface Aggregates {
  ca:              number
  valeur_achat:    number
  remise:          number
  frais_recolt:    number
  frais_livreurs:  number
  order_count:     number
  delivered_count: number
  item_qty:        number
}

interface ConfirmationConfig {
  cost_amount: number
  apply_to:    'each_order' | 'all_orders'
  based_on:    'confirmed_orders' | 'delivered_orders'
}

interface PackagingConfig {
  cost_amount: number
  apply_per:   'order' | 'product'
  based_on:    'shipped_orders' | 'delivered_orders'
}

interface BilanConfigs {
  pub_from_db:     number
  autres_charges:  number
  confirmation:    ConfirmationConfig | null
  packaging:       PackagingConfig | null
}

interface BilanData {
  aggregates: Aggregates
  configs:    BilanConfigs
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

const todayStr    = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }

function fmt(n: number): string {
  return n.toLocaleString('fr-DZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' DA'
}

function calcConfirmation(cfg: ConfirmationConfig | null, agg: Aggregates): number {
  if (!cfg) return 0
  const cnt = cfg.based_on === 'delivered_orders' ? agg.delivered_count : agg.order_count
  return cfg.apply_to === 'each_order'
    ? Number(cfg.cost_amount) * cnt
    : Number(cfg.cost_amount)
}

function calcPackaging(cfg: PackagingConfig | null, agg: Aggregates): number {
  if (!cfg) return 0
  const cnt = cfg.based_on === 'delivered_orders' ? agg.delivered_count : agg.order_count
  return cfg.apply_per === 'order'
    ? Number(cfg.cost_amount) * cnt
    : Number(cfg.cost_amount) * agg.item_qty
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BilanPage() {
  const { t } = useTranslation('accounting')
  const [boutiques,  setBoutiques]  = useState<Boutique[]>([])
  const [boutiqueId, setBoutiqueId] = useState('')
  const [from,       setFrom]       = useState(firstOfMonth())
  const [to,         setTo]         = useState(todayStr())
  const [dateBasis,  setDateBasis]  = useState<'created_at' | 'delivered_at'>('created_at')
  const [base,       setBase]       = useState<'confirmed' | 'delivered'>('confirmed')
  const [pubOverride, setPubOverride] = useState('')
  const [data,       setData]       = useState<BilanData | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')

  function configConfLabel(cfg: ConfirmationConfig): string {
    const base2 = cfg.based_on === 'delivered_orders'
      ? t('bilan.confFormula.delivered')
      : t('bilan.confFormula.confirmed')
    return cfg.apply_to === 'each_order'
      ? t('bilan.confFormula.perOrder', { amount: cfg.cost_amount, base: base2 })
      : t('bilan.confFormula.flat', { amount: cfg.cost_amount })
  }

  function configPackLabel(cfg: PackagingConfig): string {
    const base2 = cfg.based_on === 'delivered_orders'
      ? t('bilan.packFormula.delivered')
      : t('bilan.packFormula.shipped')
    const per = cfg.apply_per === 'order'
      ? t('bilan.packFormula.order')
      : t('bilan.packFormula.product')
    return t('bilan.packFormula.perUnit', { amount: cfg.cost_amount, per, base: base2 })
  }

  useEffect(() => {
    fetch('/api/boutiques', { headers: authHeader() })
      .then(r => r.json())
      .then((d: Boutique[]) => {
        if (!Array.isArray(d)) return
        setBoutiques(d)
        if (d.length > 0) setBoutiqueId(d[0].id)
      })
      .catch(() => {})
  }, [])

  const fetchBilan = useCallback(() => {
    if (!boutiqueId) { setError(t('bilan.errBoutique')); return }
    if (!from || !to) { setError(t('bilan.errPeriod')); return }
    setError('')
    setLoading(true)
    const qs = new URLSearchParams({ boutique_id: boutiqueId, from, to, date_basis: dateBasis, base })
    fetch(`/api/comptabilite/bilan?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then((d: BilanData & { error?: string }) => {
        if (d.error) { setError(d.error); return }
        setData(d)
      })
      .catch(() => setError(t('bilan.errNetwork')))
      .finally(() => setLoading(false))
  }, [boutiqueId, from, to, dateBasis, base, t])

  const bilan = data ? (() => {
    const agg  = data.aggregates
    const cfg  = data.configs
    const ca             = agg.ca
    const valeur_achat   = agg.valeur_achat
    const remise         = agg.remise
    const marge_brute    = ca - valeur_achat - remise
    const frais_recolt   = agg.frais_recolt
    const frais_livreurs = agg.frais_livreurs
    const marge_livraison = frais_recolt - frais_livreurs
    const pub            = pubOverride !== '' ? Number(pubOverride) || 0 : cfg.pub_from_db
    const confirmation   = calcConfirmation(cfg.confirmation, agg)
    const emballage      = calcPackaging(cfg.packaging, agg)
    const autres_charges = cfg.autres_charges
    const total_charges  = pub + confirmation + emballage + autres_charges
    const net            = marge_brute + marge_livraison - total_charges
    return { ca, valeur_achat, remise, marge_brute, frais_recolt, frais_livreurs, marge_livraison, pub, confirmation, emballage, autres_charges, total_charges, net }
  })() : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.bg, fontFamily: fonts.sans }}>
      <PageHeader title={t('bilan.title')} subtitle={t('bilan.subtitle')} />

      <div style={{ background: '#fff', borderBottom: `1px solid ${colors.border}`, padding: '10px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>

          <div style={{ minWidth: 170 }}>
            <div style={labelSt}>{t('bilan.filters.boutique')}</div>
            <select value={boutiqueId} onChange={e => setBoutiqueId(e.target.value)} style={selSt}>
              <option value="">{t('bilan.filters.selectBoutique')}</option>
              {boutiques.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div style={{ minWidth: 200 }}>
            <div style={labelSt}>{t('bilan.filters.calcBasis')}</div>
            <select value={base} onChange={e => setBase(e.target.value as 'confirmed' | 'delivered')} style={selSt}>
              <option value="confirmed">{t('bilan.filters.confirmed')}</option>
              <option value="delivered">{t('bilan.filters.delivered')}</option>
            </select>
          </div>

          <div style={{ minWidth: 200 }}>
            <div style={labelSt}>{t('bilan.filters.dateBasis')}</div>
            <select value={dateBasis} onChange={e => setDateBasis(e.target.value as 'created_at' | 'delivered_at')} style={selSt}>
              <option value="created_at">{t('bilan.filters.byCreated')}</option>
              <option value="delivered_at">{t('bilan.filters.byDelivered')}</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div>
              <div style={labelSt}>{t('bilan.filters.periodFrom')}</div>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputSt} />
            </div>
            <span style={{ fontSize: 12, color: colors.textLt, paddingBottom: 8 }}>–</span>
            <div>
              <div style={labelSt}>{t('bilan.filters.to')}</div>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputSt} />
            </div>
          </div>

          <button
            onClick={fetchBilan}
            disabled={loading}
            style={{
              background: loading ? colors.primaryLt : colors.primary,
              color: loading ? colors.primary : '#fff',
              border: 'none', borderRadius: 5,
              padding: '7px 20px', fontSize: 13,
              fontFamily: fonts.sans, fontWeight: 600,
              cursor: loading ? 'default' : 'pointer',
              alignSelf: 'flex-end',
            }}
          >
            {loading ? t('bilan.filters.calcLoading') : t('bilan.filters.calcBtn')}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>

        {error && (
          <div style={{ background: '#fff3f3', border: '1px solid #fca5a5', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
            {error}
          </div>
        )}

        {!data && !loading && !error && (
          <div style={{ textAlign: 'center', color: colors.textLt, fontSize: 13, paddingTop: 60 }}>
            {t('bilan.prompt')}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', color: colors.textLt, fontSize: 13, paddingTop: 60 }}>
            {t('bilan.loading')}
          </div>
        )}

        {data && bilan && (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            <div style={{ flex: '1 1 480px', minWidth: 320 }}>

              <BilanSection color="#2563EB" lightColor="#EFF6FF" title={t('bilan.sections.vente')}>
                <BilanRow label={t('bilan.rows.ca')}          value={bilan.ca}           positive />
                <BilanRow label={t('bilan.rows.valeurAchat')} value={-bilan.valeur_achat} />
                <BilanRow label={t('bilan.rows.remises')}     value={-bilan.remise}       />
                <BilanRow label={t('bilan.rows.margeBrute')}  value={bilan.marge_brute}   bold highlight positive={bilan.marge_brute >= 0} />
              </BilanSection>

              <BilanSection color="#D97706" lightColor="#FFFBEB" title={t('bilan.sections.livraison')} mt={12}>
                <BilanRow label={t('bilan.rows.fraisRecolt')}    value={bilan.frais_recolt}    positive />
                <BilanRow label={t('bilan.rows.fraisLivreurs')}  value={-bilan.frais_livreurs} />
                <BilanRow label={t('bilan.rows.margeLivraison')} value={bilan.marge_livraison} bold highlight positive={bilan.marge_livraison >= 0} />
              </BilanSection>

              <BilanSection color="#475569" lightColor="#F8FAFC" title={t('bilan.sections.charges')} mt={12}>
                <BilanRow label={t('bilan.rows.pub')} value={-bilan.pub} />
                <BilanRow
                  label={data.configs.confirmation
                    ? `${t('bilan.rows.confirmation')} (${configConfLabel(data.configs.confirmation)})`
                    : t('bilan.rows.confirmation')}
                  value={-bilan.confirmation}
                />
                <BilanRow
                  label={data.configs.packaging
                    ? `${t('bilan.rows.emballage')} (${configPackLabel(data.configs.packaging)})`
                    : t('bilan.rows.emballage')}
                  value={-bilan.emballage}
                />
                <BilanRow label={t('bilan.rows.autresCharges')} value={-bilan.autres_charges} />
                <BilanRow label={t('bilan.rows.totalCharges')}  value={-bilan.total_charges}  bold highlight />
              </BilanSection>

              <div style={{
                marginTop: 12,
                background: bilan.net >= 0 ? '#F0FDF4' : '#FFF1F2',
                border: `2px solid ${bilan.net >= 0 ? '#16A34A' : '#E11D48'}`,
                borderRadius: 8, padding: '18px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: bilan.net >= 0 ? '#15803D' : '#BE123C' }}>
                  {t('bilan.sections.resultat')}
                </span>
                <span style={{ fontSize: 22, fontWeight: 800, color: bilan.net >= 0 ? '#16A34A' : '#E11D48' }}>
                  {bilan.net >= 0 ? '+' : ''}{fmt(bilan.net)}
                </span>
              </div>
            </div>

            <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              <div style={cardSt}>
                <div style={cardTitleSt}>{t('bilan.summary.title')}</div>
                <MetaRow label={t('bilan.summary.included')}  value={data.aggregates.order_count.toString()} />
                <MetaRow label={t('bilan.summary.delivered')} value={data.aggregates.delivered_count.toString()} />
                {data.aggregates.item_qty > 0 && (
                  <MetaRow label={t('bilan.summary.items')} value={data.aggregates.item_qty.toString()} />
                )}
              </div>

              <div style={cardSt}>
                <div style={cardTitleSt}>{t('bilan.pubCard.title')}</div>
                <div style={{ fontSize: 11.5, color: colors.textLt, marginBottom: 6 }}>
                  {t('bilan.pubCard.dbValue')} {fmt(data.configs.pub_from_db)}
                </div>
                <label style={labelSt}>{t('bilan.pubCard.overrideLabel')}</label>
                <input
                  type="number" min="0"
                  placeholder={String(data.configs.pub_from_db)}
                  value={pubOverride}
                  onChange={e => setPubOverride(e.target.value)}
                  style={{ ...inputSt, width: '100%' }}
                />
                {pubOverride !== '' && (
                  <button
                    onClick={() => setPubOverride('')}
                    style={{ marginTop: 6, fontSize: 11, color: colors.textLt, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {t('bilan.pubCard.reset')}
                  </button>
                )}
              </div>

              {data.configs.confirmation && (
                <div style={cardSt}>
                  <div style={cardTitleSt}>{t('bilan.confCard.title')}</div>
                  <MetaRow label={t('bilan.confCard.unitCost')} value={`${data.configs.confirmation.cost_amount} DA`} />
                  <MetaRow
                    label={t('bilan.confCard.applyTo')}
                    value={data.configs.confirmation.apply_to === 'each_order'
                      ? t('bilan.confCard.eachOrder')
                      : t('bilan.confCard.allOrders')}
                  />
                  <MetaRow
                    label={t('bilan.confCard.basedOn')}
                    value={data.configs.confirmation.based_on === 'delivered_orders'
                      ? t('bilan.confCard.onDelivered')
                      : t('bilan.confCard.onConfirmed')}
                  />
                  <div style={{ marginTop: 8, padding: '6px 8px', background: colors.primaryLt, borderRadius: 4, fontSize: 11.5, color: colors.primary, fontWeight: 600 }}>
                    {t('bilan.confCard.total')} {fmt(bilan.confirmation)}
                  </div>
                </div>
              )}

              {data.configs.packaging && (
                <div style={cardSt}>
                  <div style={cardTitleSt}>{t('bilan.packCard.title')}</div>
                  <MetaRow label={t('bilan.packCard.unitCost')} value={`${data.configs.packaging.cost_amount} DA`} />
                  <MetaRow
                    label={t('bilan.packCard.per')}
                    value={data.configs.packaging.apply_per === 'order'
                      ? t('bilan.packCard.perOrder')
                      : t('bilan.packCard.perProduct')}
                  />
                  <MetaRow
                    label={t('bilan.packCard.basedOn')}
                    value={data.configs.packaging.based_on === 'delivered_orders'
                      ? t('bilan.packCard.onDelivered')
                      : t('bilan.packCard.onShipped')}
                  />
                  <div style={{ marginTop: 8, padding: '6px 8px', background: colors.primaryLt, borderRadius: 4, fontSize: 11.5, color: colors.primary, fontWeight: 600 }}>
                    {t('bilan.packCard.total')} {fmt(bilan.emballage)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BilanSection({
  color, lightColor, title, children, mt = 0,
}: {
  color: string; lightColor: string; title: string; children: React.ReactNode; mt?: number
}) {
  return (
    <div style={{ marginTop: mt, border: `1px solid ${color}33`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: color, color: '#fff', padding: '8px 16px', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ background: lightColor }}>
        {children}
      </div>
    </div>
  )
}

function BilanRow({ label, value, bold, highlight, positive }: { label: string; value: number; bold?: boolean; highlight?: boolean; positive?: boolean }) {
  const isNeg = value < 0
  const color = highlight
    ? (positive !== undefined ? (positive ? '#15803D' : '#BE123C') : '#1e293b')
    : (isNeg ? '#dc2626' : '#1e293b')

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)',
      background: highlight ? 'rgba(0,0,0,0.03)' : 'transparent',
    }}>
      <span style={{ fontSize: 13, fontWeight: bold ? 600 : 400, color: '#374151', maxWidth: '68%' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color }}>
        {value >= 0 ? '+' : ''}{(Math.round(value)).toLocaleString('fr-DZ')} DA
      </span>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontSize: 12, color: colors.textMd }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>{value}</span>
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
const cardSt: React.CSSProperties = {
  background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 8, padding: '12px 14px',
}
const cardTitleSt: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.4px',
  marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${colors.border}`,
}
