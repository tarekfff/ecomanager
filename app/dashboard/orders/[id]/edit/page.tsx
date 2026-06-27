'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Search, X, Plus, Minus, ArrowLeft, Save, AlertCircle, Package } from 'lucide-react'
import { PageHeader, Button, Input, Select } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Wilaya  { id: number; name: string }
interface Commune { id: number; name: string }

interface ProductSearchResult {
  id:          string
  name:        string
  sku:         string
  price:       number
  stock_total: number
}

interface ProductVariant {
  id:        string
  sku:       string
  price:     number | null
  is_active: boolean
}

interface DeliveryFeeRow {
  wilaya_id:    number | null
  delivery_fee: number
  stopdesk_fee: number
}

interface ProductDetail {
  id:                    string
  name:                  string
  sku:                   string
  price:                 number
  product_variants:      ProductVariant[]
  product_delivery_fees: DeliveryFeeRow[]
}

interface CartItem {
  key:          string
  product_id:   string
  product_name: string
  variant_id:   string | null
  sku:          string
  quantity:     number
  unit_price:   number
  unit_cost:    number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

let _key = 0
const newKey = () => `k${++_key}`

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function fmt(n: number) {
  return n.toLocaleString('fr-DZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' DA'
}

const card: React.CSSProperties = {
  background:    '#fff',
  border:        `1px solid ${colors.border}`,
  borderRadius:  8,
  padding:       16,
  display:       'flex',
  flexDirection: 'column',
  gap:           12,
}

const sectionLabel: React.CSSProperties = {
  fontSize:      12,
  fontWeight:    600,
  color:         colors.textLt,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom:  2,
}

const REFERRER_OPTIONS = [
  { value: '',           label: '— Aucune source —' },
  { value: 'Facebook',  label: 'Facebook'  },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'TikTok',   label: 'TikTok'    },
  { value: 'Autre',    label: 'Autre'      },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

function QtyStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        style={{
          width: 22, height: 22, borderRadius: 3, border: `1px solid ${colors.border}`,
          background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: colors.textMd,
        }}
      >
        <Minus size={11} />
      </button>
      <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontFamily: fonts.sans, color: colors.text }}>
        {value}
      </span>
      <button
        onClick={() => onChange(value + 1)}
        style={{
          width: 22, height: 22, borderRadius: 3, border: `1px solid ${colors.border}`,
          background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: colors.textMd,
        }}
      >
        <Plus size={11} />
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function EditOrderPage() {
  const router          = useRouter()
  const { id: orderId } = useParams<{ id: string }>()

  // ── Loading state ──────────────────────────────────────────────────────────
  const [loading,     setLoading]     = useState(true)
  const [loadError,   setLoadError]   = useState('')
  const [reference,   setReference]   = useState('')

  // ── Client state ──────────────────────────────────────────────────────────
  const [clientPhone,    setClientPhone]    = useState('')
  const [clientName,     setClientName]     = useState('')
  const [clientPhone2,   setClientPhone2]   = useState('')
  const [clientEmail,    setClientEmail]    = useState('')
  const [clientWilaya,   setClientWilaya]   = useState('')
  const [clientCommune,  setClientCommune]  = useState('')
  const [clientAddress,  setClientAddress]  = useState('')
  const [clientReferrer, setClientReferrer] = useState('')
  const [clientRemark,   setClientRemark]   = useState('')

  // ── Reference data ─────────────────────────────────────────────────────────
  const [wilayas,         setWilayas]         = useState<Wilaya[]>([])
  const [communes,        setCommunes]        = useState<Commune[]>([])
  const [communesLoading, setCommunesLoading] = useState(false)

  // ── Product search ─────────────────────────────────────────────────────────
  const [productSearch,  setProductSearch]  = useState('')
  const [searchResults,  setSearchResults]  = useState<ProductSearchResult[]>([])
  const [searchLoading,  setSearchLoading]  = useState(false)
  const [showDropdown,   setShowDropdown]   = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null)
  const [selectedVariant, setSelectedVariant] = useState('')
  const [addQty,          setAddQty]          = useState(1)
  const [addPrice,        setAddPrice]        = useState('')
  const [boutiquId,       setBoutiqueId]      = useState('')

  // ── Cart ───────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([])

  // ── Delivery ───────────────────────────────────────────────────────────────
  const [deliveryMethod, setDeliveryMethod] = useState<'domicile' | 'stopdesk'>('domicile')
  const [deliveryFee,    setDeliveryFee]    = useState('0')
  const [discount,       setDiscount]       = useState('0')

  // ── Submit ─────────────────────────────────────────────────────────────────
  const [submitting,   setSubmitting]   = useState(false)
  const [submitError,  setSubmitError]  = useState('')

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef    = useRef<HTMLDivElement>(null)

  const subtotal = cart.reduce((s, it) => s + it.unit_price * it.quantity, 0)
  const total    = subtotal + (Number(deliveryFee) || 0) - (Number(discount) || 0)

  // ── Load order on mount ────────────────────────────────────────────────────

  useEffect(() => {
    if (!orderId) return
    setLoading(true)
    fetch(`/api/orders/${orderId}`, { headers: authHeader() })
      .then(r => r.json())
      .then(o => {
        if (o.error) { setLoadError(o.error); return }

        setReference(o.reference ?? '')
        setBoutiqueId(o.boutique_id ?? '')

        // Client fields — prefer order-level phone, fall back to client record
        setClientPhone(o.phone ?? o.client?.phone ?? '')
        setClientPhone2(o.phone2 ?? o.client?.phone2 ?? '')
        setClientName(o.client?.full_name ?? '')
        setClientEmail(o.client?.email ?? '')
        setClientAddress(o.address ?? o.client?.address ?? '')
        setClientWilaya(o.wilaya_id ? String(o.wilaya_id) : '')
        setClientCommune(o.commune_id ? String(o.commune_id) : '')
        setClientReferrer(o.referrer ?? '')
        setClientRemark(o.remark ?? '')

        // Delivery
        setDeliveryMethod(o.delivery_method ?? 'domicile')
        setDeliveryFee(String(o.delivery_fee ?? 0))
        setDiscount(String(o.discount ?? 0))

        // Items → cart
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cartItems = (o.items ?? []).map((it: any) => ({
          key:          newKey(),
          product_id:   it.product_id,
          product_name: it.product_name,
          variant_id:   it.variant_id ?? null,
          sku:          it.sku,
          quantity:     it.quantity,
          unit_price:   it.unit_price,
          unit_cost:    it.unit_cost ?? 0,
        }))
        setCart(cartItems)
      })
      .catch(() => setLoadError('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [orderId])

  // ── Load wilayas once ──────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/wilayas')
      .then(r => r.json())
      .then((d: Wilaya[]) => { if (Array.isArray(d)) setWilayas(d) })
      .catch(() => {})
  }, [])

  // ── Load communes when wilaya changes ──────────────────────────────────────

  useEffect(() => {
    if (!clientWilaya) { setCommunes([]); return }
    setCommunesLoading(true)
    fetch(`/api/communes?wilaya_id=${clientWilaya}`)
      .then(r => r.json())
      .then((d: Commune[]) => { if (Array.isArray(d)) setCommunes(d) })
      .catch(() => setCommunes([]))
      .finally(() => setCommunesLoading(false))
  }, [clientWilaya])

  // ── Product search debounce ────────────────────────────────────────────────

  useEffect(() => {
    if (!productSearch.trim() || !boutiquId) {
      setSearchResults([]); setShowDropdown(false); return
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const qs  = new URLSearchParams({ search: productSearch, boutique_id: boutiquId, limit: '10' })
        const res = await fetch(`/api/products?${qs}`, { headers: authHeader() })
        const d   = await res.json() as { items?: ProductSearchResult[] }
        setSearchResults(d.items ?? [])
        setShowDropdown(true)
      } catch { setSearchResults([]) }
      finally  { setSearchLoading(false) }
    }, 250)
  }, [productSearch, boutiquId])

  // ── Close dropdown on outside click ───────────────────────────────────────

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ── Product select ─────────────────────────────────────────────────────────

  async function handleSelectProduct(p: ProductSearchResult) {
    setShowDropdown(false); setProductSearch(''); setSearchResults([])
    const res = await fetch(`/api/products/${p.id}`, { headers: authHeader() })
    if (!res.ok) return
    const detail = await res.json() as ProductDetail
    setSelectedProduct(detail)
    setSelectedVariant('')
    setAddQty(1)
    setAddPrice(String(detail.price))
    if (!detail.product_variants?.length) {
      addToCart(detail, null, 1, detail.price)
      setSelectedProduct(null)
    }
  }

  function addToCart(product: ProductDetail, variantId: string | null, qty: number, price: number) {
    if (clientWilaya) {
      const fees    = product.product_delivery_fees ?? []
      const wNum    = parseInt(clientWilaya)
      const specific = fees.find(f => f.wilaya_id === wNum)
      const fallback = fees.find(f => f.wilaya_id === null)
      const fee      = specific ?? fallback
      if (fee && cart.length === 0) {
        setDeliveryFee(String(deliveryMethod === 'stopdesk' ? fee.stopdesk_fee : fee.delivery_fee))
      }
    }

    let sku = product.sku
    if (variantId) {
      const v = product.product_variants.find(v => v.id === variantId)
      if (v) sku = v.sku
    }

    setCart(prev => [...prev, {
      key: newKey(), product_id: product.id, product_name: product.name,
      variant_id: variantId, sku, quantity: qty, unit_price: price, unit_cost: 0,
    }])
  }

  function confirmVariantAdd() {
    if (!selectedProduct) return
    if (selectedProduct.product_variants.length > 0 && !selectedVariant) return
    const price = Number(addPrice) || selectedProduct.price
    addToCart(selectedProduct, selectedVariant || null, addQty, price)
    setSelectedProduct(null)
  }

  const updateCartQty   = useCallback((key: string, qty: number)     => setCart(p => p.map(it => it.key === key ? { ...it, quantity: qty }                   : it)), [])
  const updateCartPrice = useCallback((key: string, price: string)   => setCart(p => p.map(it => it.key === key ? { ...it, unit_price: Number(price) || it.unit_price } : it)), [])
  const removeFromCart  = useCallback((key: string)                   => setCart(p => p.filter(it => it.key !== key)), [])

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitError('')
    if (!clientPhone.trim()) { setSubmitError('Le téléphone client est requis.'); return }
    if (!clientName.trim())  { setSubmitError('Le nom client est requis.'); return }
    if (cart.length === 0)   { setSubmitError('Ajoutez au moins un article.'); return }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          full_name:       clientName.trim(),
          phone:           clientPhone.trim(),
          phone2:          clientPhone2.trim()   || null,
          email:           clientEmail.trim()    || null,
          wilaya_id:       clientWilaya  ? parseInt(clientWilaya)  : null,
          commune_id:      clientCommune ? parseInt(clientCommune) : null,
          address:         clientAddress.trim()  || null,
          referrer:        clientReferrer || null,
          remark:          clientRemark.trim()   || null,
          delivery_method: deliveryMethod,
          delivery_fee:    Number(deliveryFee) || 0,
          discount:        Number(discount)    || 0,
          items: cart.map(it => ({
            product_id:   it.product_id,
            variant_id:   it.variant_id,
            product_name: it.product_name,
            sku:          it.sku,
            quantity:     it.quantity,
            unit_price:   it.unit_price,
            unit_cost:    it.unit_cost,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error ?? 'Erreur de mise à jour'); return }
      router.back()
    } catch {
      setSubmitError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render: loading / error ────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: colors.textLt, fontFamily: fonts.sans }}>
      Chargement…
    </div>
  )

  if (loadError) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, color: '#e53e3e', fontFamily: fonts.sans }}>
      <AlertCircle size={16} /> {loadError}
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: fonts.sans }}>

      <PageHeader
        title={`Modifier la commande ${reference}`}
        subtitle="Modifiez les informations client, les articles et les frais de livraison."
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={() => router.back()}>
              <ArrowLeft size={14} style={{ marginRight: 4 }} /> Annuler
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              <Save size={14} style={{ marginRight: 4 }} />
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {submitError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: 6,
            padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#e53e3e',
          }}>
            <AlertCircle size={14} /> {submitError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 320px', gap: 16, alignItems: 'start' }}>

          {/* ── Column 1 — Client info ─────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
              <div style={sectionLabel}>Informations client</div>

              <div>
                <label style={{ fontSize: 12, color: colors.textMd, marginBottom: 4, display: 'block' }}>Téléphone *</label>
                <Input value={clientPhone} onChange={v => setClientPhone(v)} placeholder="05XX XX XX XX" />
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.textMd, marginBottom: 4, display: 'block' }}>Nom complet *</label>
                <Input value={clientName} onChange={v => setClientName(v)} placeholder="Prénom Nom" />
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.textMd, marginBottom: 4, display: 'block' }}>Téléphone 2</label>
                <Input value={clientPhone2} onChange={v => setClientPhone2(v)} placeholder="Optionnel" />
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.textMd, marginBottom: 4, display: 'block' }}>Email</label>
                <Input value={clientEmail} onChange={v => setClientEmail(v)} placeholder="email@exemple.com" />
              </div>
            </div>

            <div style={card}>
              <div style={sectionLabel}>Adresse de livraison</div>

              <div>
                <label style={{ fontSize: 12, color: colors.textMd, marginBottom: 4, display: 'block' }}>Wilaya</label>
                <Select
                  value={clientWilaya}
                  onChange={v => { setClientWilaya(v); setClientCommune('') }}
                  options={[
                    { value: '', label: '— Sélectionner —' },
                    ...wilayas.map(w => ({ value: String(w.id), label: `${w.id} - ${w.name}` })),
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.textMd, marginBottom: 4, display: 'block' }}>Commune</label>
                <Select
                  value={clientCommune}
                  onChange={v => setClientCommune(v)}
                  disabled={!clientWilaya || communesLoading}
                  options={[
                    { value: '', label: communesLoading ? 'Chargement…' : '— Sélectionner —' },
                    ...communes.map(c => ({ value: String(c.id), label: c.name })),
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.textMd, marginBottom: 4, display: 'block' }}>Adresse</label>
                <Input value={clientAddress} onChange={v => setClientAddress(v)} placeholder="Rue, quartier…" />
              </div>
            </div>

            <div style={card}>
              <div style={sectionLabel}>Remarques</div>
              <div>
                <label style={{ fontSize: 12, color: colors.textMd, marginBottom: 4, display: 'block' }}>Source</label>
                <Select
                  value={clientReferrer}
                  onChange={v => setClientReferrer(v)}
                  options={REFERRER_OPTIONS}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: colors.textMd, marginBottom: 4, display: 'block' }}>Remarque</label>
                <textarea
                  value={clientRemark}
                  onChange={e => setClientRemark(e.target.value)}
                  placeholder="Note interne…"
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '7px 10px', fontSize: 13, fontFamily: fonts.sans,
                    border: `1px solid ${colors.border}`, borderRadius: 5,
                    resize: 'vertical', outline: 'none', color: colors.text,
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Column 2 — Articles ────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
              <div style={sectionLabel}>Articles</div>

              {/* Product search */}
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: colors.textLt, pointerEvents: 'none' }} />
                  <input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Rechercher un produit…"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '7px 10px 7px 30px', fontSize: 13, fontFamily: fonts.sans,
                      border: `1px solid ${colors.border}`, borderRadius: 5,
                      outline: 'none', color: colors.text,
                    }}
                  />
                  {searchLoading && (
                    <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: colors.textLt }}>…</span>
                  )}
                </div>

                {showDropdown && searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                    background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 6,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden',
                  }}>
                    {searchResults.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                          padding: '8px 12px', border: 'none', background: 'transparent',
                          cursor: 'pointer', textAlign: 'left', fontFamily: fonts.sans,
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#FAFAFA'}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                      >
                        <Package size={13} style={{ color: colors.textLt, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: colors.text, fontWeight: 500 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: colors.textLt }}>{p.sku} · {fmt(p.price)}</div>
                        </div>
                        <span style={{ fontSize: 11, color: p.stock_total > 0 ? '#38A169' : '#E53E3E', flexShrink: 0 }}>
                          Stock: {p.stock_total}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Variant picker */}
              {selectedProduct && selectedProduct.product_variants.length > 0 && (
                <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>{selectedProduct.name}</div>
                  <Select
                    value={selectedVariant}
                    onChange={val => {
                      setSelectedVariant(val)
                      const v = selectedProduct.product_variants.find(v => v.id === val)
                      if (v?.price) setAddPrice(String(v.price))
                    }}
                    options={[
                      { value: '', label: '— Choisir une variante —' },
                      ...selectedProduct.product_variants.filter(v => v.is_active).map(v => ({
                        value: v.id, label: `${v.sku}${v.price ? ' · ' + fmt(v.price) : ''}`,
                      })),
                    ]}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: colors.textLt, display: 'block', marginBottom: 3 }}>Qté</label>
                      <QtyStepper value={addQty} onChange={setAddQty} />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ fontSize: 11, color: colors.textLt, display: 'block', marginBottom: 3 }}>Prix unitaire (DA)</label>
                      <Input value={addPrice} onChange={v => setAddPrice(v)} type="number" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="sm" onClick={confirmVariantAdd} disabled={!selectedVariant}>
                      <Plus size={13} style={{ marginRight: 4 }} /> Ajouter
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setSelectedProduct(null)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              )}

              {/* Cart table */}
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: colors.textLt, fontSize: 13 }}>
                  Aucun article — recherchez un produit ci-dessus
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                      {['Produit', 'Qté', 'Prix unit.', 'Total', ''].map(h => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, color: colors.textLt, fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(it => (
                      <tr key={it.key} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '8px', color: colors.text }}>
                          <div style={{ fontWeight: 500 }}>{it.product_name}</div>
                          <div style={{ fontSize: 11, color: colors.textLt }}>{it.sku}</div>
                        </td>
                        <td style={{ padding: '8px' }}>
                          <QtyStepper value={it.quantity} onChange={qty => updateCartQty(it.key, qty)} />
                        </td>
                        <td style={{ padding: '8px', minWidth: 90 }}>
                          <input
                            type="number"
                            value={it.unit_price}
                            onChange={e => updateCartPrice(it.key, e.target.value)}
                            style={{
                              width: 80, padding: '4px 6px', fontSize: 13,
                              border: `1px solid ${colors.border}`, borderRadius: 4,
                              fontFamily: fonts.sans, color: colors.text,
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px', color: colors.text, fontWeight: 500 }}>
                          {fmt(it.unit_price * it.quantity)}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <button
                            onClick={() => removeFromCart(it.key)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E53E3E', display: 'flex', alignItems: 'center' }}
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Column 3 — Livraison + Récap ──────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
              <div style={sectionLabel}>Livraison</div>

              <div style={{ display: 'flex', gap: 8 }}>
                {(['domicile', 'stopdesk'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setDeliveryMethod(m)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 5, fontSize: 13, cursor: 'pointer',
                      fontFamily: fonts.sans, fontWeight: deliveryMethod === m ? 600 : 400,
                      border: deliveryMethod === m ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                      background: deliveryMethod === m ? colors.primaryLt : '#fff',
                      color: deliveryMethod === m ? colors.primary : colors.textMd,
                      transition: 'all .12s',
                    }}
                  >
                    {m === 'domicile' ? 'À domicile' : 'Stop desk'}
                  </button>
                ))}
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.textMd, marginBottom: 4, display: 'block' }}>Frais de livraison (DA)</label>
                <Input value={deliveryFee} onChange={v => setDeliveryFee(v)} type="number" />
              </div>

              <div>
                <label style={{ fontSize: 12, color: colors.textMd, marginBottom: 4, display: 'block' }}>Remise (DA)</label>
                <Input value={discount} onChange={v => setDiscount(v)} type="number" />
              </div>
            </div>

            <div style={card}>
              <div style={sectionLabel}>Récapitulatif</div>

              {[
                { label: 'Sous-total',       value: fmt(subtotal) },
                { label: 'Frais livraison',  value: `+ ${fmt(Number(deliveryFee) || 0)}` },
                { label: 'Remise',           value: `- ${fmt(Number(discount)    || 0)}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: colors.textMd }}>
                  <span>{label}</span><span>{value}</span>
                </div>
              ))}

              <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>Total</span>
                <span style={{ fontSize: 17, fontWeight: 700, color: colors.primary }}>{fmt(total)}</span>
              </div>
            </div>

            <div style={{ display: 'flex' }}>
              <Button onClick={handleSubmit} disabled={submitting}>
                <Save size={14} />
                {submitting ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
