'use client'
import { useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { Button, Input, Select, Modal } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'
import { useBoutique } from '@/contexts/BoutiqueContext'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Brand    { id: string; name: string }
interface Boutique { id: string; name: string; prefix: string }
interface Wilaya   { id: number; name: string }

interface OptionValue { id: string; value: string; sort_order: number }
interface OptionType  { id: string; name: string; sort_order: number; option_values: OptionValue[] }
interface SelectedAttr { optionTypeId: string; selectedValueIds: string[] }
interface VariantRow {
  rowKey:           string
  sku:              string
  price:            string      // '' = uses product price
  is_active:        boolean
  option_value_ids: string[]
  valueLabels:      string[]
}

interface DeliveryFeeRow {
  rowKey:       string
  wilaya_id:    string   // '' = all wilayas
  pricing_rule: 'standard' | 'specific'
  delivery_fee: string
  stopdesk_fee: string
}

interface FormState {
  boutique_ids:          string[]
  name:                  string
  sku:                   string
  barcode:               string
  brand_id:              string
  is_active:             boolean
  price:                 string
  compare_price:         string
  out_of_stock_behavior: 'allow' | 'deny'
  stock_alert_enabled:   boolean
  stock_alert_min:       string
  stock_strategy:        string
  external_link:         string
  confirmer_notes:       string
  weight_g:              string
  length_cm:             string
  width_cm:              string
  height_cm:             string
  delivery_fees:         DeliveryFeeRow[]
}

export interface ProductPayload {
  name:                  string
  sku:                   string
  barcode:               string | null
  brand_id:              string | null
  boutique_ids:          string[]
  is_active:             boolean
  price:                 number
  compare_price:         number | null
  out_of_stock_behavior: 'allow' | 'deny'
  stock_alert_enabled:   boolean
  stock_alert_min:       number | null
  stock_strategy:        string
  external_link:         string | null
  confirmer_notes:       string | null
  weight_g:              number | null
  length_cm:             number | null
  width_cm:              number | null
  height_cm:             number | null
  delivery_fees: Array<{
    wilaya_id:    number | null
    pricing_rule: 'standard' | 'specific'
    delivery_fee: number
    stopdesk_fee: number
  }>
  variants: Array<{
    sku:              string
    price:            number | null
    is_active:        boolean
    option_value_ids: string[]
  }>
}

export interface ProductFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?:  any
  onSubmit:      (payload: ProductPayload) => Promise<{ error?: string; field?: string }>
  submitLabel:   string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _key = 0
const newKey = () => `r${++_key}`

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

const STRATEGY_OPTIONS = [
  { value: 'fifo',   label: 'FIFO — Premier entré, premier sorti' },
  { value: 'lifo',   label: 'LIFO — Dernier entré, premier sorti' },
  { value: 'fefo',   label: 'FEFO — Premier expiré, premier sorti' },
  { value: 'random', label: 'Aléatoire' },
]

const PRICING_RULE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'specific', label: 'Spécifique' },
]

const EMPTY_FORM: FormState = {
  boutique_ids: [], name: '', sku: '', barcode: '', brand_id: '', is_active: true,
  price: '', compare_price: '',
  out_of_stock_behavior: 'allow', stock_alert_enabled: false, stock_alert_min: '',
  stock_strategy: 'fifo', external_link: '', confirmer_notes: '',
  weight_g: '', length_cm: '', width_cm: '', height_cm: '',
  delivery_fees: [{ rowKey: newKey(), wilaya_id: '', pricing_rule: 'standard', delivery_fee: '', stopdesk_fee: '' }],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFormState(data: any): FormState {
  const fees = (data.product_delivery_fees ?? []) as Array<{
    wilaya_id:    number | null
    pricing_rule: 'standard' | 'specific'
    delivery_fee: number
    stopdesk_fee: number
  }>
  const global   = fees.find(f => f.wilaya_id === null)
  const byWilaya = fees.filter(f => f.wilaya_id !== null)

  return {
    boutique_ids:          (data.product_boutiques ?? []).map((pb: { boutique_id: string }) => pb.boutique_id),
    name:                  data.name              ?? '',
    sku:                   data.sku               ?? '',
    barcode:               data.barcode           ?? '',
    brand_id:              data.brand_id          ?? '',
    is_active:             data.is_active         ?? true,
    price:                 data.price        != null ? String(data.price)         : '',
    compare_price:         data.compare_price != null ? String(data.compare_price) : '',
    out_of_stock_behavior: data.out_of_stock_behavior ?? 'allow',
    stock_alert_enabled:   data.stock_alert_enabled   ?? false,
    stock_alert_min:       data.stock_alert_min != null ? String(data.stock_alert_min) : '',
    stock_strategy:        data.stock_strategy ?? 'fifo',
    external_link:         data.external_link  ?? '',
    confirmer_notes:       data.confirmer_notes ?? '',
    weight_g:   data.weight_g   != null ? String(data.weight_g)   : '',
    length_cm:  data.length_cm  != null ? String(data.length_cm)  : '',
    width_cm:   data.width_cm   != null ? String(data.width_cm)   : '',
    height_cm:  data.height_cm  != null ? String(data.height_cm)  : '',
    delivery_fees: [
      {
        rowKey: newKey(), wilaya_id: '',
        pricing_rule: global?.pricing_rule  ?? 'standard',
        delivery_fee: global?.delivery_fee != null ? String(global.delivery_fee) : '',
        stopdesk_fee: global?.stopdesk_fee != null ? String(global.stopdesk_fee) : '',
      },
      ...byWilaya.map(f => ({
        rowKey:       newKey(),
        wilaya_id:    String(f.wilaya_id),
        pricing_rule: f.pricing_rule,
        delivery_fee: String(f.delivery_fee),
        stopdesk_fee: String(f.stopdesk_fee),
      })),
    ],
  }
}

// ── Design helpers ─────────────────────────────────────────────────────────────

function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${colors.border}`,
      borderRadius: 6,
      padding: '20px 20px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <p style={{
      margin: '0 0 16px 0', fontSize: 12, fontWeight: 700,
      color: colors.textLt, textTransform: 'uppercase', letterSpacing: '0.5px',
      fontFamily: fonts.sans,
    }}>
      {children}
    </p>
  )
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: `1px solid ${colors.border}`, margin: '20px 0' }} />
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          position: 'relative', width: 40, height: 22, borderRadius: 11,
          background: value ? colors.primary : '#d0d0d0',
          border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', display: 'block',
        }} />
      </button>
      {label && (
        <span style={{ fontSize: 13, color: colors.textMd, fontFamily: fonts.sans }}>
          {label}
        </span>
      )}
    </div>
  )
}

function NumberInput({
  label, value, onChange, placeholder, suffix, required, error,
}: {
  label?: string; value: string; onChange: (v: string) => void
  placeholder?: string; suffix?: string; required?: boolean; error?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: fonts.sans }}>
      {label && (
        <label style={{ fontSize: 12.5, fontWeight: 500, color: colors.textMd }}>
          {label}{required && <span style={{ color: colors.primary, marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: `1px solid ${error ? '#dc3545' : focused ? colors.primary : colors.border}`,
            borderRadius: 4, padding: suffix ? '7px 36px 7px 10px' : '7px 10px',
            fontSize: 13, color: colors.text, fontFamily: fonts.sans,
            outline: 'none', background: '#fff', transition: 'border-color 0.15s',
          }}
        />
        {suffix && (
          <span style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            fontSize: 12, color: colors.textLt, pointerEvents: 'none',
          }}>
            {suffix}
          </span>
        )}
      </div>
      {error && <span style={{ fontSize: 11, color: '#dc3545' }}>{error}</span>}
    </div>
  )
}

// ── Variant helpers ────────────────────────────────────────────────────────────

function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return []
  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap(a => arr.map(b => [...a, b])),
    [[]]
  )
}

function generateVariants(
  selectedAttrs: SelectedAttr[],
  optionTypes:   OptionType[],
  baseSku:       string,
  existing:      VariantRow[],
): VariantRow[] {
  const selections = selectedAttrs
    .map(attr => {
      const ot = optionTypes.find(t => t.id === attr.optionTypeId)
      return (ot?.option_values ?? []).filter(v => attr.selectedValueIds.includes(v.id))
    })
    .filter(vals => vals.length > 0)

  if (selections.length === 0) return []

  const combos = cartesian(selections)

  return combos.map(combo => {
    const valueIds = combo.map(v => v.id)
    const labels   = combo.map(v => v.value)

    const found = existing.find(r =>
      r.option_value_ids.length === valueIds.length &&
      valueIds.every(id => r.option_value_ids.includes(id))
    )
    if (found) return { ...found, valueLabels: labels }

    return {
      rowKey:           newKey(),
      sku:              [baseSku, ...labels].filter(Boolean).join('-'),
      price:            '',
      is_active:        true,
      option_value_ids: valueIds,
      valueLabels:      labels,
    }
  })
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type TabId = 'general' | 'stock' | 'livraison' | 'notes' | 'variantes'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'general',   label: 'Général' },
  { id: 'stock',     label: 'Stock' },
  { id: 'livraison', label: 'Livraison' },
  { id: 'notes',     label: 'Notes confirmateur' },
  { id: 'variantes', label: 'Variantes' },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function ProductForm({ initialData, onSubmit, submitLabel }: ProductFormProps) {
  const router                       = useRouter()
  const { boutiqueId: ctxBoutiqueId } = useBoutique()

  const [form,        setForm]        = useState<FormState>(() =>
    initialData ? buildFormState(initialData) : EMPTY_FORM
  )
  const [errors,      setErrors]      = useState<Record<string, string>>({})
  const [saving,      setSaving]      = useState(false)
  const [globalError, setGlobalError] = useState('')
  const [activeTab,   setActiveTab]   = useState<TabId>('general')

  const [brands,      setBrands]      = useState<Brand[]>([])
  const [boutiques,   setBoutiques]   = useState<Boutique[]>([])
  const [wilayas,     setWilayas]     = useState<Wilaya[]>([])

  const [brandModal,   setBrandModal]   = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [brandSaving,  setBrandSaving]  = useState(false)
  const [brandError,   setBrandError]   = useState('')

  // Variants tab state
  const [optionTypes,      setOptionTypes]      = useState<OptionType[]>([])
  const [selectedAttrs,    setSelectedAttrs]    = useState<SelectedAttr[]>([])
  const [variants,         setVariants]         = useState<VariantRow[]>([])
  const [attrSelectorOpen, setAttrSelectorOpen] = useState(false)
  const [newTypeName,      setNewTypeName]      = useState('')
  const [creatingType,     setCreatingType]     = useState(false)
  const [typeCreateErr,    setTypeCreateErr]    = useState('')

  // Refs to avoid stale closures in regeneration effect
  const variantsRef = useRef<VariantRow[]>([])
  variantsRef.current = variants
  const skuRef = useRef(form.sku)
  skuRef.current = form.sku

  // Track whether we've auto-selected the boutique so we only do it once
  const didAutoSelect = useRef(false)
  // Track whether initial variant data was loaded (to avoid re-init on every render)
  const varInitDone = useRef(false)

  useEffect(() => {
    if (initialData) setForm(buildFormState(initialData))
  }, [initialData])

  const loadBrands = useCallback(() => {
    fetch('/api/brands', { headers: authHeader() })
      .then(r => r.json())
      .then((d: Brand[]) => { if (Array.isArray(d)) setBrands(d) })
      .catch(() => {})
  }, [])

  const loadOptionTypes = useCallback(() => {
    fetch('/api/option-types', { headers: authHeader() })
      .then(r => r.json())
      .then((d: OptionType[]) => { if (Array.isArray(d)) setOptionTypes(d) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadBrands()
    loadOptionTypes()
    fetch('/api/boutiques', { headers: authHeader() })
      .then(r => r.json())
      .then((d: Boutique[]) => { if (Array.isArray(d)) setBoutiques(d) })
      .catch(() => {})
    fetch('/api/wilayas')
      .then(r => r.json())
      .then((d: Wilaya[]) => { if (Array.isArray(d)) setWilayas(d) })
      .catch(() => {})
  }, [loadBrands, loadOptionTypes])

  // Initialize variant state from initialData once option types are loaded
  useEffect(() => {
    if (varInitDone.current) return
    if (!initialData?.product_variants || optionTypes.length === 0) return

    varInitDone.current = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingVars = (initialData.product_variants as any[])

    const valueMap = new Map<string, { label: string; typeId: string }>()
    for (const ot of optionTypes) {
      for (const v of ot.option_values) {
        valueMap.set(v.id, { label: v.value, typeId: ot.id })
      }
    }

    const initVariants: VariantRow[] = existingVars.map(v => {
      const valueIds: string[] = (v.variant_options ?? []).map((o: { option_value_id: string }) => o.option_value_id)
      return {
        rowKey:           newKey(),
        sku:              v.sku,
        price:            v.price != null ? String(v.price) : '',
        is_active:        v.is_active ?? true,
        option_value_ids: valueIds,
        valueLabels:      valueIds.map(id => valueMap.get(id)?.label ?? id),
      }
    })
    setVariants(initVariants)
    variantsRef.current = initVariants

    // Derive selectedAttrs from used value IDs
    const usedIds = new Set(existingVars.flatMap(v =>
      (v.variant_options ?? []).map((o: { option_value_id: string }) => o.option_value_id)
    ))
    const derived: SelectedAttr[] = optionTypes
      .map(ot => ({
        optionTypeId:     ot.id,
        selectedValueIds: ot.option_values.filter(v => usedIds.has(v.id)).map(v => v.id),
      }))
      .filter(a => a.selectedValueIds.length > 0)

    setSelectedAttrs(derived)
  }, [initialData, optionTypes])

  // Regenerate variant matrix whenever selected attributes change
  useEffect(() => {
    const newVars = generateVariants(selectedAttrs, optionTypes, skuRef.current, variantsRef.current)
    setVariants(newVars)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAttrs, optionTypes])

  // For new products: auto-select the current boutique from context once boutiques load
  useEffect(() => {
    if (
      !didAutoSelect.current &&
      !initialData &&
      boutiques.length > 0 &&
      ctxBoutiqueId &&
      boutiques.some(b => b.id === ctxBoutiqueId)
    ) {
      didAutoSelect.current = true
      setForm(f => f.boutique_ids.length === 0 ? { ...f, boutique_ids: [ctxBoutiqueId] } : f)
    }
  }, [boutiques, ctxBoutiqueId, initialData])

  // ── Field helpers ──────────────────────────────────────────────────────────

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => { const n = { ...e }; delete n[key]; return n })
  }

  function toggleBoutique(id: string) {
    setForm(f => ({
      ...f,
      boutique_ids: f.boutique_ids.includes(id)
        ? f.boutique_ids.filter(b => b !== id)
        : [...f.boutique_ids, id],
    }))
  }

  function setFeeField(rowKey: string, field: keyof Omit<DeliveryFeeRow, 'rowKey'>, value: string) {
    setForm(f => ({
      ...f,
      delivery_fees: f.delivery_fees.map(r => r.rowKey === rowKey ? { ...r, [field]: value } : r),
    }))
  }

  function addWilayaFee() {
    setForm(f => ({
      ...f,
      delivery_fees: [
        ...f.delivery_fees,
        { rowKey: newKey(), wilaya_id: '', pricing_rule: 'standard', delivery_fee: '', stopdesk_fee: '' },
      ],
    }))
  }

  function removeWilayaFee(rowKey: string) {
    setForm(f => ({ ...f, delivery_fees: f.delivery_fees.filter(r => r.rowKey !== rowKey) }))
  }

  // ── Create brand ───────────────────────────────────────────────────────────

  async function handleCreateBrand() {
    if (!newBrandName.trim()) { setBrandError('Le nom est requis'); return }
    setBrandSaving(true); setBrandError('')
    try {
      const res  = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ name: newBrandName.trim() }),
      })
      const data = await res.json() as Brand & { error?: string }
      if (!res.ok) { setBrandError(data.error ?? 'Erreur'); return }
      setBrands(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      set('brand_id', data.id)
      setBrandModal(false); setNewBrandName('')
    } finally { setBrandSaving(false) }
  }

  // ── Variants helpers ───────────────────────────────────────────────────────

  function toggleAttrValue(optionTypeId: string, valueId: string) {
    setSelectedAttrs(prev => {
      const existing = prev.find(a => a.optionTypeId === optionTypeId)
      if (existing) {
        const ids = existing.selectedValueIds.includes(valueId)
          ? existing.selectedValueIds.filter(id => id !== valueId)
          : [...existing.selectedValueIds, valueId]
        // Remove attribute entirely if no values remain selected
        if (ids.length === 0) return prev.filter(a => a.optionTypeId !== optionTypeId)
        return prev.map(a => a.optionTypeId === optionTypeId ? { ...a, selectedValueIds: ids } : a)
      }
      return [...prev, { optionTypeId, selectedValueIds: [valueId] }]
    })
  }

  function addAttribute(optionTypeId: string) {
    setSelectedAttrs(prev =>
      prev.some(a => a.optionTypeId === optionTypeId)
        ? prev
        : [...prev, { optionTypeId, selectedValueIds: [] }]
    )
    setAttrSelectorOpen(false)
  }

  function removeAttribute(optionTypeId: string) {
    setSelectedAttrs(prev => prev.filter(a => a.optionTypeId !== optionTypeId))
  }

  function setVariantField(rowKey: string, field: 'sku' | 'price', value: string) {
    setVariants(prev => prev.map(v => v.rowKey === rowKey ? { ...v, [field]: value } : v))
  }

  function setVariantActive(rowKey: string, value: boolean) {
    setVariants(prev => prev.map(v => v.rowKey === rowKey ? { ...v, is_active: value } : v))
  }

  async function handleCreateOptionType() {
    if (!newTypeName.trim()) { setTypeCreateErr('Le nom est requis'); return }
    setCreatingType(true); setTypeCreateErr('')
    try {
      const res  = await fetch('/api/option-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ name: newTypeName.trim() }),
      })
      const data = await res.json() as OptionType & { error?: string }
      if (!res.ok) { setTypeCreateErr(data.error ?? 'Erreur'); return }
      setOptionTypes(prev => [...prev, data])
      addAttribute(data.id)
      setNewTypeName('')
    } finally {
      setCreatingType(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = 'Le nom du produit est requis'
    if (!form.sku.trim())  errs.sku  = 'Le SKU est requis'
    const price = parseFloat(form.price)
    if (!form.price || isNaN(price) || price <= 0) errs.price = 'Le prix de vente est requis'
    if (form.compare_price) {
      const cp = parseFloat(form.compare_price)
      if (cp <= price) errs.compare_price = 'Doit être > prix de vente'
    }
    if (Object.keys(errs).length) {
      setErrors(errs)
      setActiveTab('general')   // jump to the tab that has errors
      return
    }

    const fees = form.delivery_fees
      .filter(f => f.delivery_fee || f.stopdesk_fee)
      .map(f => ({
        wilaya_id:    f.wilaya_id ? parseInt(f.wilaya_id) : null,
        pricing_rule: f.pricing_rule,
        delivery_fee: parseFloat(f.delivery_fee) || 0,
        stopdesk_fee: parseFloat(f.stopdesk_fee) || 0,
      }))

    const payload: ProductPayload = {
      name:                  form.name.trim(),
      sku:                   form.sku.trim(),
      barcode:               form.barcode.trim() || null,
      brand_id:              form.brand_id || null,
      boutique_ids:          form.boutique_ids,
      is_active:             form.is_active,
      price,
      compare_price:         form.compare_price ? parseFloat(form.compare_price) : null,
      out_of_stock_behavior: form.out_of_stock_behavior,
      stock_alert_enabled:   form.stock_alert_enabled,
      stock_alert_min:       form.stock_alert_enabled && form.stock_alert_min
                               ? parseInt(form.stock_alert_min) : null,
      stock_strategy:        form.stock_strategy,
      external_link:         form.external_link.trim()   || null,
      confirmer_notes:       form.confirmer_notes.trim() || null,
      weight_g:   form.weight_g   ? parseFloat(form.weight_g)   : null,
      length_cm:  form.length_cm  ? parseFloat(form.length_cm)  : null,
      width_cm:   form.width_cm   ? parseFloat(form.width_cm)   : null,
      height_cm:  form.height_cm  ? parseFloat(form.height_cm)  : null,
      delivery_fees: fees,
      variants: variants
        .filter(v => v.option_value_ids.length > 0 && v.sku.trim())
        .map(v => ({
          sku:              v.sku.trim(),
          price:            v.price ? parseFloat(v.price) : null,
          is_active:        v.is_active,
          option_value_ids: v.option_value_ids,
        })),
    }

    setSaving(true); setGlobalError('')
    const result = await onSubmit(payload)
    setSaving(false)
    if (result.error) {
      if (result.field === 'sku') {
        setErrors({ sku: result.error })
        setActiveTab('general')
      } else {
        setGlobalError(result.error)
      }
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const brandOptions  = brands.map(b  => ({ value: b.id,   label: b.name }))
  const usedWilayaIds = new Set(form.delivery_fees.filter(r => r.wilaya_id).map(r => r.wilaya_id))
  const generalHasErr = !!(errors.name || errors.sku || errors.price || errors.compare_price)

  // ── Tab content ────────────────────────────────────────────────────────────

  const tabContent: Record<TabId, ReactNode> = {

    // ── GÉNÉRAL ───────────────────────────────────────────────────────────────
    general: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Boutiques */}
        {boutiques.length > 0 && (
          <Card>
            <CardTitle>Boutique(s) cible</CardTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {boutiques.map(b => {
                const checked = form.boutique_ids.includes(b.id)
                return (
                  <label
                    key={b.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                      border: `1px solid ${checked ? colors.primary : colors.border}`,
                      background: checked ? colors.primaryLt : '#fff',
                      fontFamily: fonts.sans, fontSize: 13,
                      color: checked ? colors.primary : colors.textMd,
                      fontWeight: checked ? 600 : 400,
                      userSelect: 'none', transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBoutique(b.id)}
                      style={{ accentColor: colors.primary, cursor: 'pointer', width: 14, height: 14 }}
                    />
                    {b.name}
                    {b.prefix && (
                      <span style={{ fontSize: 11, color: colors.textLt, fontWeight: 400 }}>
                        [{b.prefix}]
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </Card>
        )}

        {/* Identification */}
        <Card>
          <CardTitle>Identification</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              label="Nom du produit" value={form.name}
              onChange={v => set('name', v)} placeholder="Ex : T-shirt Premium"
              required error={errors.name}
            />
            <Input
              label="SKU" value={form.sku}
              onChange={v => set('sku', v)} placeholder="Ex : TSH-001"
              required error={errors.sku}
            />
            <Input
              label="Code à barres" value={form.barcode}
              onChange={v => set('barcode', v)} placeholder="EAN-13 ou autre"
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: colors.textMd, fontFamily: fonts.sans }}>
                  Marque
                </span>
                <button
                  type="button"
                  onClick={() => { setBrandModal(true); setBrandError(''); setNewBrandName('') }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: colors.primary, fontFamily: fonts.sans, padding: 0,
                  }}
                >
                  + Créer une marque
                </button>
              </div>
              <Select
                value={form.brand_id} onChange={v => set('brand_id', v)}
                options={brandOptions} placeholder="Sélectionner"
              />
            </div>
          </div>

          <Divider />

          <Toggle
            value={form.is_active}
            onChange={v => set('is_active', v)}
            label={form.is_active ? 'Produit actif (visible dans les commandes)' : 'Produit inactif'}
          />
        </Card>

        {/* Tarification */}
        <Card>
          <CardTitle>Tarification</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <NumberInput
              label="Prix de vente" value={form.price} onChange={v => set('price', v)}
              placeholder="0" suffix="DA" required error={errors.price}
            />
            <NumberInput
              label="Prix de comparaison" value={form.compare_price}
              onChange={v => set('compare_price', v)}
              placeholder="0 (barré sur la fiche produit)" suffix="DA" error={errors.compare_price}
            />
          </div>
          {form.compare_price && parseFloat(form.compare_price) > parseFloat(form.price || '0') && (
            <p style={{ marginTop: 10, fontSize: 12, color: colors.green, fontFamily: fonts.sans }}>
              Remise affichée : {Math.round((1 - parseFloat(form.price) / parseFloat(form.compare_price)) * 100)}%
            </p>
          )}
        </Card>
      </div>
    ),

    // ── STOCK ────────────────────────────────────────────────────────────────
    stock: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <CardTitle>Comportement si rupture de stock</CardTitle>
          <div style={{ display: 'flex', gap: 24 }}>
            {(['allow', 'deny'] as const).map(v => (
              <label key={v} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', fontSize: 13, fontFamily: fonts.sans, color: colors.textMd,
              }}>
                <input
                  type="radio" name="oos" value={v}
                  checked={form.out_of_stock_behavior === v}
                  onChange={() => set('out_of_stock_behavior', v)}
                  style={{ accentColor: colors.primary, width: 15, height: 15 }}
                />
                {v === 'allow' ? 'Autoriser la commande' : 'Refuser la commande'}
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Alerte de rupture</CardTitle>
          <Toggle
            value={form.stock_alert_enabled}
            onChange={v => set('stock_alert_enabled', v)}
            label="Activer les alertes de rupture"
          />
          {form.stock_alert_enabled && (
            <div style={{ marginTop: 16, maxWidth: 220 }}>
              <NumberInput
                label="Stock minimum d'alerte"
                value={form.stock_alert_min}
                onChange={v => set('stock_alert_min', v)}
                placeholder="Ex : 5"
                suffix="unités"
              />
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Stratégie de sortie des lots</CardTitle>
          <div style={{ maxWidth: 400 }}>
            <Select
              value={form.stock_strategy}
              onChange={v => set('stock_strategy', v)}
              options={STRATEGY_OPTIONS}
            />
          </div>
          <p style={{ marginTop: 10, fontSize: 12, color: colors.textLt, fontFamily: fonts.sans }}>
            {{
              fifo:   'Les lots les plus anciens sont expédiés en premier.',
              lifo:   'Les lots les plus récents sont expédiés en premier.',
              fefo:   'Les lots qui expirent le plus tôt sont expédiés en premier.',
              random: "L'ordre de sortie est choisi aléatoirement.",
            }[form.stock_strategy] ?? ''}
          </p>
        </Card>
      </div>
    ),

    // ── LIVRAISON ────────────────────────────────────────────────────────────
    livraison: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Dimensions */}
        <Card>
          <CardTitle>Poids & Dimensions</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <NumberInput label="Poids" value={form.weight_g}  onChange={v => set('weight_g', v)}  placeholder="0" suffix="g"  />
            <NumberInput label="Longueur" value={form.length_cm} onChange={v => set('length_cm', v)} placeholder="0" suffix="cm" />
            <NumberInput label="Largeur"  value={form.width_cm}  onChange={v => set('width_cm', v)}  placeholder="0" suffix="cm" />
            <NumberInput label="Hauteur"  value={form.height_cm} onChange={v => set('height_cm', v)} placeholder="0" suffix="cm" />
          </div>
        </Card>

        {/* Frais de livraison */}
        <Card>
          <CardTitle>Frais de livraison par wilaya</CardTitle>

          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 150px 130px 130px 36px',
            gap: 8, paddingBottom: 8, borderBottom: `1px solid ${colors.border}`,
          }}>
            {['Wilaya', 'Règle tarifaire', 'Frais livraison', 'Frais stop desk', ''].map(h => (
              <span key={h} style={{ fontSize: 11.5, fontWeight: 600, color: colors.textLt, fontFamily: fonts.sans }}>
                {h}
              </span>
            ))}
          </div>

          {/* Fee rows */}
          {form.delivery_fees.map((row, idx) => {
            const isGlobal     = idx === 0
            const availableWilayas = wilayas.filter(
              w => !usedWilayaIds.has(String(w.id)) || row.wilaya_id === String(w.id)
            )
            return (
              <div
                key={row.rowKey}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 150px 130px 130px 36px',
                  gap: 8, alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: `1px solid ${colors.border}`,
                  background: isGlobal ? '#fafafa' : '#fff',
                }}
              >
                {isGlobal ? (
                  <span style={{ fontSize: 13, fontFamily: fonts.sans, color: colors.textMd, fontWeight: 500 }}>
                    Toutes les wilayas
                  </span>
                ) : (
                  <Select
                    value={row.wilaya_id}
                    onChange={v => setFeeField(row.rowKey, 'wilaya_id', v)}
                    options={availableWilayas.map(w => ({
                      value: String(w.id),
                      label: `${String(w.id).padStart(2, '0')} — ${w.name}`,
                    }))}
                    placeholder="Sélectionner"
                  />
                )}
                <Select
                  value={row.pricing_rule}
                  onChange={v => setFeeField(row.rowKey, 'pricing_rule', v as 'standard' | 'specific')}
                  options={PRICING_RULE_OPTIONS}
                />
                <FeeInput
                  value={row.delivery_fee}
                  onChange={v => setFeeField(row.rowKey, 'delivery_fee', v)}
                />
                <FeeInput
                  value={row.stopdesk_fee}
                  onChange={v => setFeeField(row.rowKey, 'stopdesk_fee', v)}
                />
                {isGlobal ? <span /> : (
                  <button
                    type="button"
                    onClick={() => removeWilayaFee(row.rowKey)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 30, height: 30, border: `1px solid #f5c6cb`,
                      background: '#fff8f8', borderRadius: 4, cursor: 'pointer', color: colors.red,
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={addWilayaFee}
            disabled={form.delivery_fees.length > wilayas.length}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              marginTop: 12, padding: '6px 12px', borderRadius: 4,
              border: `1px dashed ${colors.primary}`, background: colors.primaryLt,
              color: colors.primary, fontFamily: fonts.sans, fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            <Plus size={13} /> Ajouter une surcharge wilaya
          </button>
        </Card>
      </div>
    ),

    // ── VARIANTES ─────────────────────────────────────────────────────────────
    variantes: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Attribute selection */}
        <Card>
          <CardTitle>Attributs</CardTitle>

          {selectedAttrs.length === 0 && (
            <p style={{ fontSize: 13, color: colors.textLt, fontFamily: fonts.sans, marginBottom: 14 }}>
              Aucun attribut sélectionné. Ajoutez des attributs (Couleur, Taille…) pour générer les variantes.
            </p>
          )}

          {selectedAttrs.map(attr => {
            const ot = optionTypes.find(t => t.id === attr.optionTypeId)
            if (!ot) return null
            return (
              <div key={attr.optionTypeId} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: fonts.sans }}>
                    {ot.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttribute(attr.optionTypeId)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textLt, padding: 2 }}
                    title="Supprimer cet attribut"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ot.option_values.map(val => {
                    const checked = attr.selectedValueIds.includes(val.id)
                    return (
                      <label
                        key={val.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px', borderRadius: 20, cursor: 'pointer',
                          border: `1px solid ${checked ? colors.primary : colors.border}`,
                          background: checked ? colors.primaryLt : '#fff',
                          fontSize: 12.5, fontFamily: fonts.sans,
                          color: checked ? colors.primary : colors.textMd,
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAttrValue(attr.optionTypeId, val.id)}
                          style={{ display: 'none' }}
                        />
                        {val.value}
                      </label>
                    )
                  })}
                  {ot.option_values.length === 0 && (
                    <span style={{ fontSize: 12, color: colors.textLt, fontFamily: fonts.sans }}>
                      Aucune valeur définie pour cet attribut.
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => setAttrSelectorOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 4, marginTop: 4,
              border: `1px dashed ${colors.primary}`, background: colors.primaryLt,
              color: colors.primary, fontFamily: fonts.sans, fontSize: 12.5,
              cursor: 'pointer',
            }}
          >
            <Plus size={13} /> Ajouter un attribut
          </button>
        </Card>

        {/* Variants matrix */}
        {variants.length > 0 && (
          <Card>
            <CardTitle>Variantes générées ({variants.length})</CardTitle>

            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 200px 140px 80px',
              gap: 8, paddingBottom: 8,
              borderBottom: `1px solid ${colors.border}`,
            }}>
              {['Combinaison', 'SKU', 'Prix (DA)', 'Actif'].map(h => (
                <span key={h} style={{ fontSize: 11.5, fontWeight: 600, color: colors.textLt, fontFamily: fonts.sans }}>
                  {h}
                </span>
              ))}
            </div>

            {variants.map(v => (
              <div
                key={v.rowKey}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 200px 140px 80px',
                  gap: 8, alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                {/* Combination label */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {v.valueLabels.map((lbl, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '2px 8px', borderRadius: 12,
                        background: '#f0f0f0', fontSize: 12,
                        fontFamily: fonts.sans, color: colors.textMd,
                      }}
                    >
                      {lbl}
                    </span>
                  ))}
                </div>

                {/* SKU */}
                <TextInput value={v.sku} onChange={val => setVariantField(v.rowKey, 'sku', val)} />

                {/* Price override */}
                <input
                  type="number"
                  value={v.price}
                  onChange={e => setVariantField(v.rowKey, 'price', e.target.value)}
                  placeholder={`= ${form.price || 'prix produit'}`}
                  style={{
                    border: `1px solid ${colors.border}`, borderRadius: 4,
                    padding: '7px 8px', fontSize: 13, fontFamily: fonts.sans,
                    color: colors.text, outline: 'none',
                    width: '100%', boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.target.style.borderColor = colors.primary)}
                  onBlur={e  => (e.target.style.borderColor = colors.border)}
                />

                {/* Active toggle */}
                <Toggle value={v.is_active} onChange={val => setVariantActive(v.rowKey, val)} />
              </div>
            ))}
          </Card>
        )}
      </div>
    ),

    // ── NOTES ────────────────────────────────────────────────────────────────
    notes: (
      <Card>
        <CardTitle>Notes confirmateur</CardTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Lien externe" type="url"
            value={form.external_link} onChange={v => set('external_link', v)}
            placeholder="https://…"
          />
          <div>
            <label style={{
              display: 'block', fontSize: 12.5, color: colors.textMd,
              fontWeight: 500, marginBottom: 4, fontFamily: fonts.sans,
            }}>
              Notes pour le confirmateur
            </label>
            <textarea
              value={form.confirmer_notes}
              onChange={e => set('confirmer_notes', e.target.value)}
              placeholder="Instructions visibles par les confirmateurs lors de la prise en charge de la commande…"
              rows={6}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: `1px solid ${colors.border}`, borderRadius: 4,
                padding: '8px 10px', fontSize: 13, fontFamily: fonts.sans,
                color: colors.text, resize: 'vertical', outline: 'none',
                lineHeight: 1.5,
              }}
              onFocus={e => (e.target.style.borderColor = colors.primary)}
              onBlur={e  => (e.target.style.borderColor = colors.border)}
            />
          </div>
        </div>
      </Card>
    ),
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'flex-end',
        borderBottom: `1px solid ${colors.border}`,
        background: '#fff', paddingLeft: 16, flexShrink: 0,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id
          const hasErr = tab.id === 'general' && generalHasErr
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: 'none', background: 'none',
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: hasErr ? colors.red : active ? colors.primary : colors.textMd,
                borderBottom: active
                  ? `2px solid ${hasErr ? colors.red : colors.primary}`
                  : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: -1,
                fontFamily: fonts.sans,
                transition: 'color 0.15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {tab.label}
              {hasErr && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 16, height: 16, borderRadius: '50%',
                  background: colors.red, color: '#fff', fontSize: 10, fontWeight: 700,
                }}>
                  !
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 0 16px' }}>
        {tabContent[activeTab]}
      </div>

      {/* Bottom action bar */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${colors.border}`,
        background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        {globalError ? (
          <span style={{ fontSize: 12.5, color: colors.red, fontFamily: fonts.sans }}>
            {globalError}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: colors.textLt, fontFamily: fonts.sans }}>
            Les champs marqués <span style={{ color: colors.primary }}>*</span> sont obligatoires.
          </span>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/products')}>
            Annuler
          </Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSubmit}>
            {submitLabel}
          </Button>
        </div>
      </div>

      {/* Attribute selector modal */}
      <Modal open={attrSelectorOpen} onClose={() => { setAttrSelectorOpen(false); setNewTypeName(''); setTypeCreateErr('') }} title="Ajouter un attribut" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {optionTypes
            .filter(ot => !selectedAttrs.some(a => a.optionTypeId === ot.id))
            .map(ot => (
              <button
                key={ot.id}
                type="button"
                onClick={() => addAttribute(ot.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 12px', borderRadius: 5,
                  border: `1px solid ${colors.border}`, background: '#fff',
                  fontSize: 13, fontFamily: fonts.sans, color: colors.text,
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = colors.primaryLt; (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primary }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border }}
              >
                <span>{ot.name}</span>
                <span style={{ fontSize: 11, color: colors.textLt }}>
                  {ot.option_values.length} valeur{ot.option_values.length !== 1 ? 's' : ''}
                </span>
              </button>
            ))
          }
          {optionTypes.every(ot => selectedAttrs.some(a => a.optionTypeId === ot.id)) && optionTypes.length > 0 && (
            <p style={{ fontSize: 12.5, color: colors.textLt, fontFamily: fonts.sans, margin: 0 }}>
              Tous les attributs existants sont déjà sélectionnés.
            </p>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: `1px solid ${colors.border}`, margin: '8px 0 12px' }} />

        <p style={{ fontSize: 12.5, fontWeight: 600, color: colors.textMd, fontFamily: fonts.sans, marginBottom: 8 }}>
          Créer un nouveau type d&apos;attribut
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Input
              value={newTypeName}
              onChange={v => { setNewTypeName(v); setTypeCreateErr('') }}
              placeholder="Ex : Couleur, Taille…"
            />
          </div>
          <Button variant="primary" size="sm" loading={creatingType} onClick={handleCreateOptionType}>
            Créer
          </Button>
        </div>
        {typeCreateErr && (
          <p style={{ fontSize: 11.5, color: colors.red, marginTop: 6, fontFamily: fonts.sans }}>
            {typeCreateErr}
          </p>
        )}
      </Modal>

      {/* Create brand modal */}
      <Modal open={brandModal} onClose={() => setBrandModal(false)} title="Créer une marque" size="sm">
        <Input
          label="Nom de la marque" value={newBrandName} onChange={setNewBrandName}
          placeholder="Ex : Nike, Adidas…" required
        />
        {brandError && (
          <p style={{ fontSize: 12, color: colors.red, marginTop: 8, fontFamily: fonts.sans }}>
            {brandError}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button variant="secondary" size="sm" onClick={() => setBrandModal(false)}>Annuler</Button>
          <Button variant="primary" size="sm" loading={brandSaving} onClick={handleCreateBrand}>Créer</Button>
        </div>
      </Modal>
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="text" value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        border: `1px solid ${focused ? colors.primary : colors.border}`,
        borderRadius: 4, padding: '7px 8px', fontSize: 13,
        fontFamily: fonts.sans, color: colors.text,
        outline: 'none', width: '100%', boxSizing: 'border-box',
        transition: 'border-color 0.15s',
      }}
    />
  )
}

// Small inline component to avoid prop repetition in fee rows
function FeeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="number" value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="0 DA"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        border: `1px solid ${focused ? colors.primary : colors.border}`,
        borderRadius: 4, padding: '7px 8px', fontSize: 13,
        fontFamily: fonts.sans, color: colors.text,
        outline: 'none', width: '100%', boxSizing: 'border-box',
        transition: 'border-color 0.15s',
      }}
    />
  )
}
