'use client'

import { useState, useEffect, useCallback } from 'react'
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

function configConfLabel(cfg: ConfirmationConfig): string {
  const base = cfg.based_on === 'delivered_orders' ? 'livrées' : 'confirmées'
  return cfg.apply_to === 'each_order'
    ? `${cfg.cost_amount} DA × commandes ${base}`
    : `Forfait ${cfg.cost_amount} DA`
}

function configPackLabel(cfg: PackagingConfig): string {
  const base  = cfg.based_on === 'delivered_orders' ? 'livrées' : 'expédiées'
  const perLbl = cfg.apply_per === 'order' ? 'commande' : 'produit'
  return `${cfg.cost_amount} DA par ${perLbl} (${base})`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BilanPage() {
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

  // Fetch boutiques once
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
    if (!boutiqueId) { setError('Veuillez sélectionner une boutique.'); return }
    if (!from || !to) { setError('Veuillez choisir une période.'); return }
    setError('')
    setLoading(true)
    const qs = new URLSearchParams({ boutique_id: boutiqueId, from, to, date_basis: dateBasis, base })
    fetch(`/api/comptabilite/bilan?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then((d: BilanData & { error?: string }) => {
        if (d.error) { setError(d.error); return }
        setData(d)
      })
      .catch(() => setError('Erreur réseau'))
      .finally(() => setLoading(false))
  }, [boutiqueId, from, to, dateBasis, base])

  // Derived bilan numbers (recalculate when pub override changes)
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

    return {
      ca, valeur_achat, remise, marge_brute,
      frais_recolt, frais_livreurs, marge_livraison,
      pub, confirmation, emballage, autres_charges, total_charges,
      net,
    }
  })() : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.bg, fontFamily: fonts.sans }}>
      <PageHeader
        title="Bilan général"
        subtitle="Analyse financière complète — ventes, livraison, charges, résultat net"
      />

      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderBottom: `1px solid ${colors.border}`,
        padding: '10px 16px',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>

          {/* Boutique */}
          <div style={{ minWidth: 170 }}>
            <div style={labelSt}>Boutique</div>
            <select
              value={boutiqueId}
              onChange={e => setBoutiqueId(e.target.value)}
              style={selSt}
            >
              <option value="">-- Sélectionner --</option>
              {boutiques.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Calculer selon */}
          <div style={{ minWidth: 200 }}>
            <div style={labelSt}>Calculer selon</div>
            <select
              value={base}
              onChange={e => setBase(e.target.value as 'confirmed' | 'delivered')}
              style={selSt}
            >
              <option value="confirmed">Commandes confirmées</option>
              <option value="delivered">Commandes livrées</option>
            </select>
          </div>

          {/* Date basis */}
          <div style={{ minWidth: 200 }}>
            <div style={labelSt}>Filtrer par date</div>
            <select
              value={dateBasis}
              onChange={e => setDateBasis(e.target.value as 'created_at' | 'delivered_at')}
              style={selSt}
            >
              <option value="created_at">Date de création</option>
              <option value="delivered_at">Date de livraison</option>
            </select>
          </div>

          {/* Period */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div>
              <div style={labelSt}>Période De</div>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputSt} />
            </div>
            <span style={{ fontSize: 12, color: colors.textLt, paddingBottom: 8 }}>–</span>
            <div>
              <div style={labelSt}>À</div>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputSt} />
            </div>
          </div>

          {/* Calculate button */}
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
            {loading ? 'Calcul…' : 'Calculer'}
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>

        {error && (
          <div style={{
            background: '#fff3f3', border: `1px solid #fca5a5`,
            borderRadius: 6, padding: '10px 14px',
            fontSize: 13, color: '#dc2626', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {!data && !loading && !error && (
          <div style={{
            textAlign: 'center', color: colors.textLt,
            fontSize: 13, paddingTop: 60,
          }}>
            Sélectionnez une boutique et une période, puis cliquez sur <strong>Calculer</strong>.
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', color: colors.textLt, fontSize: 13, paddingTop: 60 }}>
            Calcul en cours…
          </div>
        )}

        {data && bilan && (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* ── Left: Bilan table ───────────────────────────────── */}
            <div style={{ flex: '1 1 480px', minWidth: 320 }}>

              {/* Section 1: Vente — Blue */}
              <BilanSection color="#2563EB" lightColor="#EFF6FF" title="Vente">
                <BilanRow label="Chiffre d'affaires (CA)" value={bilan.ca} positive />
                <BilanRow label="Valeur d'achat" value={-bilan.valeur_achat} />
                <BilanRow label="Remises accordées" value={-bilan.remise} />
                <BilanRow
                  label="Marge brute"
                  value={bilan.marge_brute}
                  bold
                  highlight
                  positive={bilan.marge_brute >= 0}
                />
              </BilanSection>

              {/* Section 2: Livraison — Amber */}
              <BilanSection color="#D97706" lightColor="#FFFBEB" title="Livraison" mt={12}>
                <BilanRow label="Frais de livraison collectés" value={bilan.frais_recolt} positive />
                <BilanRow label="Frais livreurs (carrier)" value={-bilan.frais_livreurs} />
                <BilanRow
                  label="Marge livraison"
                  value={bilan.marge_livraison}
                  bold
                  highlight
                  positive={bilan.marge_livraison >= 0}
                />
              </BilanSection>

              {/* Section 3: Charges — Slate */}
              <BilanSection color="#475569" lightColor="#F8FAFC" title="Charges" mt={12}>
                <BilanRow label="Publicité" value={-bilan.pub} />
                <BilanRow
                  label={data.configs.confirmation
                    ? `Confirmation (${configConfLabel(data.configs.confirmation)})`
                    : 'Confirmation'}
                  value={-bilan.confirmation}
                />
                <BilanRow
                  label={data.configs.packaging
                    ? `Emballage (${configPackLabel(data.configs.packaging)})`
                    : 'Emballage'}
                  value={-bilan.emballage}
                />
                <BilanRow label="Autres charges" value={-bilan.autres_charges} />
                <BilanRow
                  label="Total charges"
                  value={-bilan.total_charges}
                  bold
                  highlight
                />
              </BilanSection>

              {/* Section 4: Résultat — Green */}
              <div style={{
                marginTop: 12,
                background: bilan.net >= 0 ? '#F0FDF4' : '#FFF1F2',
                border: `2px solid ${bilan.net >= 0 ? '#16A34A' : '#E11D48'}`,
                borderRadius: 8, padding: '18px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{
                  fontSize: 15, fontWeight: 700,
                  color: bilan.net >= 0 ? '#15803D' : '#BE123C',
                }}>
                  Résultat net
                </span>
                <span style={{
                  fontSize: 22, fontWeight: 800,
                  color: bilan.net >= 0 ? '#16A34A' : '#E11D48',
                }}>
                  {bilan.net >= 0 ? '+' : ''}{fmt(bilan.net)}
                </span>
              </div>
            </div>

            {/* ── Right: Config & summary ──────────────────────────── */}
            <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Order summary */}
              <div style={cardSt}>
                <div style={cardTitleSt}>Résumé</div>
                <MetaRow label="Commandes incluses"    value={data.aggregates.order_count.toString()} />
                <MetaRow label="Dont livrées"         value={data.aggregates.delivered_count.toString()} />
                {data.aggregates.item_qty > 0 && (
                  <MetaRow label="Produits (qtés)"    value={data.aggregates.item_qty.toString()} />
                )}
              </div>

              {/* Pub override */}
              <div style={cardSt}>
                <div style={cardTitleSt}>Frais publicitaires</div>
                <div style={{ fontSize: 11.5, color: colors.textLt, marginBottom: 6 }}>
                  Valeur DB : {fmt(data.configs.pub_from_db)}
                </div>
                <label style={labelSt}>Montant (override)</label>
                <input
                  type="number"
                  min="0"
                  placeholder={String(data.configs.pub_from_db)}
                  value={pubOverride}
                  onChange={e => setPubOverride(e.target.value)}
                  style={{ ...inputSt, width: '100%' }}
                />
                {pubOverride !== '' && (
                  <button
                    onClick={() => setPubOverride('')}
                    style={{
                      marginTop: 6, fontSize: 11, color: colors.textLt,
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}
                  >
                    Réinitialiser
                  </button>
                )}
              </div>

              {/* Confirmation config */}
              {data.configs.confirmation && (
                <div style={cardSt}>
                  <div style={cardTitleSt}>Config. confirmation</div>
                  <MetaRow label="Montant unitaire" value={`${data.configs.confirmation.cost_amount} DA`} />
                  <MetaRow
                    label="Appliquer à"
                    value={data.configs.confirmation.apply_to === 'each_order' ? 'Chaque commande' : 'Toutes (forfait)'}
                  />
                  <MetaRow
                    label="Basé sur"
                    value={data.configs.confirmation.based_on === 'delivered_orders' ? 'Livrées' : 'Confirmées'}
                  />
                  <div style={{
                    marginTop: 8, padding: '6px 8px',
                    background: colors.primaryLt, borderRadius: 4,
                    fontSize: 11.5, color: colors.primary, fontWeight: 600,
                  }}>
                    Total : {fmt(bilan.confirmation)}
                  </div>
                </div>
              )}

              {/* Packaging config */}
              {data.configs.packaging && (
                <div style={cardSt}>
                  <div style={cardTitleSt}>Config. emballage</div>
                  <MetaRow label="Montant unitaire" value={`${data.configs.packaging.cost_amount} DA`} />
                  <MetaRow
                    label="Par"
                    value={data.configs.packaging.apply_per === 'order' ? 'Commande' : 'Produit'}
                  />
                  <MetaRow
                    label="Basé sur"
                    value={data.configs.packaging.based_on === 'delivered_orders' ? 'Livrées' : 'Expédiées'}
                  />
                  <div style={{
                    marginTop: 8, padding: '6px 8px',
                    background: colors.primaryLt, borderRadius: 4,
                    fontSize: 11.5, color: colors.primary, fontWeight: 600,
                  }}>
                    Total : {fmt(bilan.emballage)}
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
    <div style={{
      marginTop: mt,
      border: `1px solid ${color}33`,
      borderRadius: 8, overflow: 'hidden',
    }}>
      <div style={{
        background: color, color: '#fff',
        padding: '8px 16px', fontSize: 12.5, fontWeight: 700,
        letterSpacing: '0.3px', textTransform: 'uppercase',
      }}>
        {title}
      </div>
      <div style={{ background: lightColor }}>
        {children}
      </div>
    </div>
  )
}

function BilanRow({
  label, value, bold, highlight, positive,
}: {
  label: string; value: number; bold?: boolean; highlight?: boolean; positive?: boolean
}) {
  const isNeg = value < 0
  const color = highlight
    ? (positive !== undefined ? (positive ? '#15803D' : '#BE123C') : '#1e293b')
    : (isNeg ? '#dc2626' : '#1e293b')

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 16px',
      borderBottom: `1px solid rgba(0,0,0,0.04)`,
      background: highlight ? 'rgba(0,0,0,0.03)' : 'transparent',
    }}>
      <span style={{
        fontSize: 13, fontWeight: bold ? 600 : 400,
        color: '#374151', maxWidth: '68%',
      }}>
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
  display: 'block', fontSize: 11, color: colors.textMd,
  marginBottom: 3, fontWeight: 500,
}

const selSt: React.CSSProperties = {
  border: `1px solid ${colors.border}`, borderRadius: 4,
  padding: '6px 8px', fontSize: 12.5,
  fontFamily: fonts.sans, color: colors.text,
  background: '#fff', outline: 'none', cursor: 'pointer', width: '100%',
}

const inputSt: React.CSSProperties = {
  border: `1px solid ${colors.border}`, borderRadius: 4,
  padding: '6px 8px', fontSize: 12.5,
  fontFamily: fonts.sans, color: colors.text,
  background: '#fff', outline: 'none',
}

const cardSt: React.CSSProperties = {
  background: '#fff', border: `1px solid ${colors.border}`,
  borderRadius: 8, padding: '12px 14px',
}

const cardTitleSt: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: colors.text,
  textTransform: 'uppercase', letterSpacing: '0.4px',
  marginBottom: 10, paddingBottom: 8,
  borderBottom: `1px solid ${colors.border}`,
}
