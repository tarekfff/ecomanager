'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Plus, Minus, AlertCircle, Package } from 'lucide-react'
import { PageHeader, Button, Input, Select } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'
import { useBoutique } from '@/contexts/BoutiqueContext'

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
  id:         string
  sku:        string
  price:      number | null
  is_active:  boolean
}

interface DeliveryFeeRow {
  wilaya_id:    number | null
  pricing_rule: 'standard' | 'specific'
  delivery_fee: number
  stopdesk_fee: number
}

interface ProductDetail {
  id:             string
  name:           string
  sku:            string
  price:          number
  product_variants: ProductVariant[]
  product_delivery_fees: DeliveryFeeRow[]
}

interface CartItem {
  key:          string
  product_id:   string
  product_name: string
  variant_id:   string | null
  variant_sku:  string | null
  sku:          string
  quantity:     number
  unit_price:   number
  unit_cost:    number
}

// ── Constants ──────────────────────────────────────────────────────────────────

let _key = 0
const newKey = () => `k${++_key}`

const REFERRER_OPTIONS = [
  { value: 'Facebook',   label: 'Facebook'   },
  { value: 'Instagram',  label: 'Instagram'  },
  { value: 'TikTok',     label: 'TikTok'     },
  { value: 'Boutic OR',     label: 'Boutic'     },
  { value: 'Autre',      label: 'Autre'      },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function fmt(n: number) {
  return n.toLocaleString('fr-DZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' DA'
}

// ── Panel card style ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background:   '#fff',
  border:       `1px solid ${colors.border}`,
  borderRadius: 8,
  padding:      16,
  display:      'flex',
  flexDirection:'column',
  gap:          12,
}

const sectionLabel: React.CSSProperties = {
  fontSize:   12,
  fontWeight: 600,
  color:      colors.textLt,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 2,
}

// ── Sub-component: Qty stepper ─────────────────────────────────────────────────

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

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function NewOrderPage() {
  const router             = useRouter()
  const { boutiqueId }     = useBoutique()

  // ── Client state ───────────────────────────────────────────────────────────
  const [clientPhone,    setClientPhone]    = useState('')
  const [clientName,     setClientName]     = useState('')
  const [clientPhone2,   setClientPhone2]   = useState('')
  const [clientEmail,    setClientEmail]    = useState('')
  const [clientWilaya,   setClientWilaya]   = useState('')
  const [clientCommune,  setClientCommune]  = useState('')
  const [clientAddress,  setClientAddress]  = useState('')
  const [clientReferrer, setClientReferrer] = useState('')
  const [clientRemark,   setClientRemark]   = useState('')
  const [phoneSearching, setPhoneSearching] = useState(false)
  const [clientFound,    setClientFound]    = useState(false)

  // ── Reference data ─────────────────────────────────────────────────────────
  const [wilayas,         setWilayas]         = useState<Wilaya[]>([])
  const [communes,        setCommunes]        = useState<Commune[]>([])
  const [communesLoading, setCommunesLoading] = useState(false)

  // ── Product search state ───────────────────────────────────────────────────
  const [productSearch,   setProductSearch]   = useState('')
  const [searchResults,   setSearchResults]   = useState<ProductSearchResult[]>([])
  const [searchLoading,   setSearchLoading]   = useState(false)
  const [showDropdown,    setShowDropdown]     = useState(false)

  // ── Selected product (for variant picking) ─────────────────────────────────
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null)
  const [selectedVariant, setSelectedVariant] = useState('')
  const [addQty,          setAddQty]          = useState(1)
  const [addPrice,        setAddPrice]        = useState('')

  // ── Cart ───────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([])

  // ── Delivery ───────────────────────────────────────────────────────────────
  const [deliveryMethod, setDeliveryMethod] = useState<'domicile' | 'stopdesk'>('domicile')
  const [deliveryFee,    setDeliveryFee]    = useState('0')
  const [discount,       setDiscount]       = useState('0')

  // ── Form submission ────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const searchRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef   = useRef<HTMLDivElement>(null)

  // ── Computed values ────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, it) => s + it.unit_price * it.quantity, 0)
  const total    = subtotal + (Number(deliveryFee) || 0) - (Number(discount) || 0)

  // ── Load reference data ────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/wilayas')
      .then(r => r.json())
      .then((d: Wilaya[]) => { if (Array.isArray(d)) setWilayas(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!clientWilaya) { setCommunes([]); return }
    setCommunesLoading(true)
    fetch(`/api/communes?wilaya_id=${clientWilaya}`)
      .then(r => r.json())
      .then((d: Commune[]) => { if (Array.isArray(d)) setCommunes(d) })
      .catch(() => setCommunes([]))
      .finally(() => setCommunesLoading(false))
  }, [clientWilaya])

  // ── Auto-fill delivery fee when wilaya or cart changes ─────────────────────

  const recomputeFee = useCallback((wilayaId: string, method: 'domicile' | 'stopdesk', currentCart: CartItem[]) => {
    if (!wilayaId || currentCart.length === 0) return
    // Use the first product in cart that has delivery fees configured
    // (In a real app you might merge fees; here we take max)
    // Fee is fetched per-product when product is loaded; we store it on the CartItem via selectedProduct
    // For simplicity, fee is just auto-filled when the product is added (see addToCart)
  }, [])

  useEffect(() => {
    recomputeFee(clientWilaya, deliveryMethod, cart)
  }, [clientWilaya, deliveryMethod, cart, recomputeFee])

  // ── Phone search ───────────────────────────────────────────────────────────

  async function searchByPhone() {
    const ph = clientPhone.trim()
    if (!ph) return
    setPhoneSearching(true)
    setClientFound(false)
    try {
      const res = await fetch(
        `/api/clients?search=${encodeURIComponent(ph)}&limit=1`,
        { headers: authHeader() }
      )
      const data = await res.json() as { clients?: Array<{
        full_name: string; phone: string; phone2?: string | null;
        email?: string | null; address?: string | null;
        wilaya_id?: number | null; commune_id?: number | null;
      }> }
      const found = data.clients?.[0]
      if (found && found.phone === ph) {
        setClientName(found.full_name)
        setClientPhone2(found.phone2 ?? '')
        setClientEmail(found.email ?? '')
        setClientAddress(found.address ?? '')
        setClientWilaya(found.wilaya_id ? String(found.wilaya_id) : '')
        setClientCommune(found.commune_id ? String(found.commune_id) : '')
        setClientFound(true)
      }
    } finally {
      setPhoneSearching(false)
    }
  }

  // ── Product search debounce ────────────────────────────────────────────────

  useEffect(() => {
    if (!productSearch.trim() || !boutiqueId) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const qs  = new URLSearchParams({ search: productSearch, boutique_id: boutiqueId, limit: '10' })
        const res = await fetch(`/api/products?${qs}`, { headers: authHeader() })
        const d   = await res.json() as { items?: ProductSearchResult[] }
        setSearchResults(d.items ?? [])
        setShowDropdown(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 250)
  }, [productSearch, boutiqueId])

  // ── Close dropdown on outside click ───────────────────────────────────────

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Select product from dropdown ───────────────────────────────────────────

  async function handleSelectProduct(p: ProductSearchResult) {
    setShowDropdown(false)
    setProductSearch('')
    setSearchResults([])

    // Fetch full product details (variants + delivery fees)
    const res = await fetch(`/api/products/${p.id}`, { headers: authHeader() })
    if (!res.ok) return
    const detail = await res.json() as ProductDetail

    setSelectedProduct(detail)
    setSelectedVariant('')
    setAddQty(1)
    setAddPrice(String(detail.price))

    // If no variants, add directly
    if (!detail.product_variants || detail.product_variants.length === 0) {
      addToCart(detail, null, null, 1, detail.price)
      setSelectedProduct(null)
    }
  }

  // ── Add item to cart ───────────────────────────────────────────────────────

  function addToCart(
    product:   ProductDetail,
    variantId: string | null,
    variantSku: string | null,
    qty:       number,
    price:     number,
  ) {
    // Try to fill delivery fee from product fees for current wilaya
    if (clientWilaya) {
      const fees = product.product_delivery_fees ?? []
      const wilayaNum = parseInt(clientWilaya)
      const specific = fees.find(f => f.wilaya_id === wilayaNum)
      const fallback = fees.find(f => f.wilaya_id === null)
      const applicable = specific ?? fallback
      if (applicable && cart.length === 0) {
        const fee = deliveryMethod === 'stopdesk'
          ? applicable.stopdesk_fee
          : applicable.delivery_fee
        setDeliveryFee(String(fee))
      }
    }

    const sku = variantSku ?? product.sku
    setCart(prev => [...prev, {
      key:          newKey(),
      product_id:   product.id,
      product_name: product.name,
      variant_id:   variantId,
      variant_sku:  variantSku,
      sku,
      quantity:     qty,
      unit_price:   price,
      unit_cost:    0,
    }])
  }

  function confirmVariantAdd() {
    if (!selectedProduct) return
    const price = Number(addPrice) || selectedProduct.price

    if (selectedProduct.product_variants.length > 0 && !selectedVariant) {
      return // force selection
    }

    let variantId:  string | null = null
    let variantSku: string | null = null

    if (selectedVariant) {
      const v = selectedProduct.product_variants.find(v => v.id === selectedVariant)
      if (v) { variantId = v.id; variantSku = v.sku }
    }

    addToCart(selectedProduct, variantId, variantSku, addQty, price)
    setSelectedProduct(null)
  }

  function updateCartQty(key: string, qty: number) {
    setCart(prev => prev.map(it => it.key === key ? { ...it, quantity: qty } : it))
  }

  function updateCartPrice(key: string, price: string) {
    setCart(prev => prev.map(it => it.key === key ? { ...it, unit_price: Number(price) || it.unit_price } : it))
  }

  function removeFromCart(key: string) {
    setCart(prev => prev.filter(it => it.key !== key))
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitError('')
    if (!boutiqueId)           { setSubmitError('Aucune boutique sélectionnée dans la barre de navigation.'); return }
    if (!clientPhone.trim())   { setSubmitError('Le téléphone client est requis.'); return }
    if (!clientName.trim())    { setSubmitError('Le nom client est requis.'); return }
    if (cart.length === 0)     { setSubmitError('Ajoutez au moins un article à la commande.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          boutique_id:     boutiqueId,
          full_name:       clientName.trim(),
          phone:           clientPhone.trim(),
          phone2:          clientPhone2.trim() || null,
          email:           clientEmail.trim()  || null,
          wilaya_id:       clientWilaya  ? parseInt(clientWilaya)  : null,
          commune_id:      clientCommune ? parseInt(clientCommune) : null,
          address:         clientAddress.trim() || null,
          referrer:        clientReferrer || null,
          remark:          clientRemark.trim() || null,
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
      const data = await res.json() as { error?: string }
      if (!res.ok) { setSubmitError(data.error ?? 'Erreur lors de la création.'); return }
      router.push('/dashboard/orders/en-confirmation')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Derived options ────────────────────────────────────────────────────────

  const wilayaOptions = wilayas.map(w => ({
    value: String(w.id),
    label: `${String(w.id).padStart(2, '0')} — ${w.name}`,
  }))

  const communeOptions = communes.map(c => ({ value: String(c.id), label: c.name }))

  const variantOptions = (selectedProduct?.product_variants ?? [])
    .filter(v => v.is_active)
    .map(v => ({ value: v.id, label: `${v.sku}${v.price ? ` — ${v.price} DA` : ''}` }))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Nouvelle commande"
        subtitle="Créez une commande manuelle"
        actions={
          <Button variant="secondary" size="sm" onClick={() => router.back()}>
            ← Retour
          </Button>
        }
      />

      <div style={{
        flex: 1, overflow: 'auto', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
        fontFamily: fonts.sans,
      }}>

        {/* No boutique warning */}
        {!boutiqueId && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff8e1', border: '1px solid #ffe082',
            borderRadius: 6, padding: '10px 14px',
            fontSize: 13, color: '#795548',
          }}>
            <AlertCircle size={15} />
            Sélectionnez une boutique dans la barre de navigation avant de créer une commande.
          </div>
        )}

        {/* Error banner */}
        {submitError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff0f0', border: `1px solid #f5c6cb`,
            borderRadius: 6, padding: '10px 14px',
            fontSize: 13, color: colors.red,
          }}>
            <AlertCircle size={15} />
            {submitError}
          </div>
        )}

        {/* 3-column grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 300px) 1fr minmax(220px, 280px)',
          gap: 12,
          alignItems: 'start',
        }}>

          {/* ── LEFT: Client ─────────────────────────────────────────────── */}
          <div style={card}>
            <div style={sectionLabel}>Client</div>

            {/* Phone search */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="Téléphone *"
                  value={clientPhone}
                  onChange={v => { setClientPhone(v); setClientFound(false) }}
                  placeholder="0555 00 00 00"
                  required
                />
              </div>
              <button
                onClick={searchByPhone}
                disabled={phoneSearching || !clientPhone.trim()}
                title="Rechercher le client par téléphone"
                style={{
                  height: 34, width: 34, borderRadius: 4, flexShrink: 0,
                  border: `1px solid ${colors.border}`,
                  background: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colors.textMd, opacity: (!clientPhone.trim() || phoneSearching) ? 0.5 : 1,
                }}
              >
                <Search size={14} />
              </button>
            </div>

            {clientFound && (
              <div style={{
                fontSize: 11.5, color: colors.green,
                background: '#f0faf0', borderRadius: 4, padding: '4px 8px',
              }}>
                ✓ Client existant — champs pré-remplis
              </div>
            )}

            <Input
              label="Nom complet *"
              value={clientName}
              onChange={setClientName}
              placeholder="Ahmed Benali"
              required
            />

            <Input
              label="Téléphone 2"
              value={clientPhone2}
              onChange={setClientPhone2}
              placeholder="Optionnel"
            />

            <Input
              label="Email"
              type="email"
              value={clientEmail}
              onChange={setClientEmail}
              placeholder="client@example.com"
            />

            <Select
              label="Wilaya"
              value={clientWilaya}
              onChange={v => { setClientWilaya(v); setClientCommune('') }}
              options={wilayaOptions}
              placeholder="Sélectionner une wilaya"
            />

            <Select
              label="Commune"
              value={clientCommune}
              onChange={setClientCommune}
              options={communeOptions}
              placeholder={
                communesLoading
                  ? 'Chargement…'
                  : clientWilaya
                    ? 'Sélectionner une commune'
                    : 'Sélectionnez d\'abord une wilaya'
              }
              disabled={!clientWilaya || communesLoading}
            />

            <Input
              label="Adresse"
              value={clientAddress}
              onChange={setClientAddress}
              placeholder="Rue, quartier…"
            />

            <Select
              label="Référent"
              value={clientReferrer}
              onChange={setClientReferrer}
              options={REFERRER_OPTIONS}
              placeholder="Source du client"
            />

            {/* Remarque */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12.5, fontWeight: 500, color: colors.textMd }}>
                Remarque
              </label>
              <textarea
                value={clientRemark}
                onChange={e => setClientRemark(e.target.value)}
                placeholder="Notes internes sur la commande…"
                rows={3}
                style={{
                  width: '100%', border: `1px solid ${colors.border}`, borderRadius: 4,
                  padding: '7px 10px', fontSize: 13, color: colors.text, fontFamily: fonts.sans,
                  outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: '#fff',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
                onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
              />
            </div>
          </div>

          {/* ── CENTER: Products ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
              <div style={sectionLabel}>Articles</div>

              {/* Product search */}
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{
                    position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
                    color: colors.textLt, pointerEvents: 'none',
                  }} />
                  <input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder={boutiqueId ? 'Rechercher un produit par nom ou SKU…' : 'Sélectionnez d\'abord une boutique'}
                    disabled={!boutiqueId}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: `1px solid ${colors.border}`, borderRadius: 4,
                      padding: '7px 10px 7px 30px',
                      fontSize: 13, color: colors.text, fontFamily: fonts.sans,
                      outline: 'none', background: boutiqueId ? '#fff' : '#f7f7f7',
                      cursor: boutiqueId ? 'text' : 'not-allowed',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
                    onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
                  />
                  {searchLoading && (
                    <span style={{
                      position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                      fontSize: 11, color: colors.textLt,
                    }}>…</span>
                  )}
                </div>

                {/* Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2, maxHeight: 240, overflowY: 'auto',
                  }}>
                    {searchResults.map(p => (
                      <button
                        key={p.id}
                        onMouseDown={() => handleSelectProduct(p)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '8px 12px', border: 'none',
                          background: 'transparent', cursor: 'pointer', fontFamily: fonts.sans,
                          textAlign: 'left',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = colors.primaryLt)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div>
                          <div style={{ fontSize: 13, color: colors.text, fontWeight: 500 }}>{p.name}</div>
                          <div style={{ fontSize: 11.5, color: colors.textLt }}>{p.sku}</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                          <div style={{ fontSize: 13, color: colors.primary, fontWeight: 600 }}>
                            {p.price.toLocaleString('fr-DZ')} DA
                          </div>
                          <div style={{ fontSize: 11, color: colors.textLt }}>
                            Stock: {p.stock_total}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showDropdown && !searchLoading && searchResults.length === 0 && productSearch.trim() && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 4,
                    padding: '10px 14px', fontSize: 13, color: colors.textLt,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginTop: 2,
                  }}>
                    Aucun produit trouvé
                  </div>
                )}
              </div>

              {/* Variant + qty picker (inline, appears after product is selected) */}
              {selectedProduct && (
                <div style={{
                  background: colors.primaryLt, border: `1px solid ${colors.primary}22`,
                  borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
                        {selectedProduct.name}
                      </div>
                      <div style={{ fontSize: 11.5, color: colors.textLt }}>SKU: {selectedProduct.sku}</div>
                    </div>
                    <button
                      onClick={() => setSelectedProduct(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textLt, padding: 2 }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: variantOptions.length > 0 ? '1fr 1fr auto auto' : '1fr auto auto', gap: 8, alignItems: 'flex-end' }}>
                    {variantOptions.length > 0 && (
                      <Select
                        label="Variante *"
                        value={selectedVariant}
                        onChange={v => {
                          setSelectedVariant(v)
                          const found = selectedProduct.product_variants.find(pv => pv.id === v)
                          if (found?.price) setAddPrice(String(found.price))
                          else setAddPrice(String(selectedProduct.price))
                        }}
                        options={variantOptions}
                        placeholder="Choisir"
                      />
                    )}
                    <Input
                      label="Prix unitaire"
                      value={addPrice}
                      onChange={setAddPrice}
                      type="number"
                      placeholder="DA"
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 12.5, fontWeight: 500, color: colors.textMd }}>Qté</label>
                      <QtyStepper value={addQty} onChange={setAddQty} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={confirmVariantAdd}
                        disabled={variantOptions.length > 0 && !selectedVariant}
                      >
                        <Plus size={13} /> Ajouter
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Cart table */}
              {cart.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '24px 0', color: colors.textLt,
                  fontSize: 13, borderTop: `1px solid ${colors.border}`,
                }}>
                  <Package size={24} style={{ marginBottom: 6, opacity: 0.4 }} />
                  <div>Aucun article ajouté</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: fonts.sans }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                        {['Produit', 'Variante', 'Qté', 'Prix unit.', 'Total', ''].map(h => (
                          <th key={h} style={{
                            textAlign: 'left', padding: '6px 8px',
                            fontSize: 11.5, color: colors.textLt, fontWeight: 600,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map(item => (
                        <tr key={item.key} style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <td style={{ padding: '7px 8px', color: colors.text, fontWeight: 500, maxWidth: 160 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.product_name}
                            </div>
                            <div style={{ fontSize: 11, color: colors.textLt }}>{item.sku}</div>
                          </td>
                          <td style={{ padding: '7px 8px', color: colors.textMd }}>
                            {item.variant_sku ?? <span style={{ color: colors.textLt }}>—</span>}
                          </td>
                          <td style={{ padding: '7px 8px' }}>
                            <QtyStepper value={item.quantity} onChange={v => updateCartQty(item.key, v)} />
                          </td>
                          <td style={{ padding: '7px 8px' }}>
                            <input
                              type="number"
                              value={item.unit_price}
                              onChange={e => updateCartPrice(item.key, e.target.value)}
                              style={{
                                width: 80, border: `1px solid ${colors.border}`, borderRadius: 3,
                                padding: '3px 6px', fontSize: 12.5, fontFamily: fonts.sans,
                                color: colors.text, outline: 'none', background: '#fff',
                              }}
                              onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
                              onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
                            />
                            <span style={{ fontSize: 11, color: colors.textLt, marginLeft: 3 }}>DA</span>
                          </td>
                          <td style={{ padding: '7px 8px', color: colors.text, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {(item.unit_price * item.quantity).toLocaleString('fr-DZ')} DA
                          </td>
                          <td style={{ padding: '7px 8px' }}>
                            <button
                              onClick={() => removeFromCart(item.key)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: colors.textLt, padding: 3, display: 'flex', alignItems: 'center',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = colors.red)}
                              onMouseLeave={e => (e.currentTarget.style.color = colors.textLt)}
                            >
                              <X size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Subtotal row */}
                  <div style={{
                    display: 'flex', justifyContent: 'flex-end', padding: '8px 8px 0',
                    fontSize: 13, color: colors.textMd, fontFamily: fonts.sans,
                  }}>
                    Sous-total :&nbsp;
                    <strong style={{ color: colors.text }}>{fmt(subtotal)}</strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Delivery & Recap ─────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
              <div style={sectionLabel}>Livraison</div>

              {/* Delivery method */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: colors.textMd }}>
                  Méthode de livraison
                </label>
                {(['domicile', 'stopdesk'] as const).map(method => (
                  <label
                    key={method}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      cursor: 'pointer', fontSize: 13, color: colors.text,
                      padding: '7px 10px', borderRadius: 4,
                      border: `1px solid ${deliveryMethod === method ? colors.primary : colors.border}`,
                      background: deliveryMethod === method ? colors.primaryLt : '#fff',
                    }}
                  >
                    <input
                      type="radio"
                      name="delivery_method"
                      value={method}
                      checked={deliveryMethod === method}
                      onChange={() => setDeliveryMethod(method)}
                      style={{ accentColor: colors.primary, cursor: 'pointer' }}
                    />
                    {method === 'domicile' ? 'À domicile' : 'Stop Desk'}
                  </label>
                ))}
              </div>

              <Input
                label="Frais de livraison (DA)"
                value={deliveryFee}
                onChange={setDeliveryFee}
                type="number"
                placeholder="0"
              />

              <Input
                label="Remise (DA)"
                value={discount}
                onChange={setDiscount}
                type="number"
                placeholder="0"
              />
            </div>

            {/* Recap card */}
            <div style={{ ...card, gap: 10 }}>
              <div style={sectionLabel}>Récapitulatif</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { label: 'Sous-total',          value: fmt(subtotal) },
                  { label: 'Frais de livraison',  value: fmt(Number(deliveryFee) || 0) },
                  { label: 'Remise',              value: `– ${fmt(Number(discount) || 0)}` },
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 13, color: colors.textMd,
                  }}>
                    <span>{row.label}</span>
                    <span style={{ color: colors.text }}>{row.value}</span>
                  </div>
                ))}

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingTop: 8, borderTop: `1px solid ${colors.border}`,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>Total</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: colors.primary }}>
                    {fmt(total)}
                  </span>
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                loading={submitting}
                onClick={handleSubmit}
                disabled={!boutiqueId || cart.length === 0 || submitting}
              >
                Créer la commande
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
