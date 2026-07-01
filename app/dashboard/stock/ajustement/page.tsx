'use client'
import { useState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader, Button, Input, Select } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Warehouse { id: string; name: string }
interface Product   { id: string; name: string; sku: string | null }
interface Variant   { id: string; sku: string; price: number | null; is_active: boolean }
interface Batch {
  id:           string
  batch_number: string | null
  quantity:     number
  unit_cost:    number | null
  expiry_date:  string | null
}

type OpType     = 'add' | 'remove' | 'correct'
type TargetType = 'new_batch' | 'global' | 'existing_batch'

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHdr() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('fr-DZ')
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({ step, labels }: { step: 1 | 2; labels: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24, fontFamily: fonts.sans }}>
      {labels.map((label, i) => {
        const n      = (i + 1) as 1 | 2
        const done   = step > n
        const active = step === n
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 1 ? 1 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: done ? colors.green : active ? colors.primary : '#ddd',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>
                {done ? '✓' : n}
              </div>
              <span style={{
                fontSize: 12, fontWeight: active ? 600 : 400,
                color: active ? colors.primary : done ? colors.textMd : colors.textLt,
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </div>
            {i < 1 && (
              <div style={{ flex: 1, height: 1, margin: '0 10px', background: done ? colors.green : '#ddd' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 8, padding: 28 }}>
      {children}
    </div>
  )
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: colors.textMd, fontFamily: fonts.sans, marginBottom: 4 }}>
      {label}{required && <span style={{ color: colors.primary, marginLeft: 2 }}>*</span>}
    </span>
  )
}

function RadioBtn({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        cursor: 'pointer', fontSize: 13, color: colors.text,
        fontFamily: fonts.sans, userSelect: 'none',
        padding: '6px 14px', borderRadius: 5,
        border: `1px solid ${checked ? colors.primary : colors.border}`,
        background: checked ? colors.primaryLt : '#fff',
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${checked ? colors.primary : colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.primary }} />}
      </div>
      {label}
    </div>
  )
}

function ErrBanner({ msg }: { msg: string }) {
  return (
    <div style={{ fontSize: 12.5, color: '#842029', padding: '9px 14px', background: '#f8d7da', borderRadius: 5, border: '1px solid #f5c2c7', fontFamily: fonts.sans }}>
      {msg}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function StockAjustementPage() {
  const { t } = useTranslation('stock')
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1
  const [warehouses,   setWarehouses]   = useState<Warehouse[]>([])
  const [warehouseId,  setWarehouseId]  = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [prodResults,  setProdResults]  = useState<Product[]>([])
  const [showDrop,     setShowDrop]     = useState(false)
  const [product,      setProduct]      = useState<Product | null>(null)
  const [variants,     setVariants]     = useState<Variant[]>([])
  const [variantId,    setVariantId]    = useState('')
  const [op,           setOp]           = useState<OpType>('add')

  // Step 2
  const [target,       setTarget]       = useState<TargetType>('new_batch')
  const [batches,      setBatches]      = useState<Batch[]>([])
  const [batchId,      setBatchId]      = useState('')
  const [quantity,     setQuantity]     = useState('')
  const [unitCost,     setUnitCost]     = useState('')
  const [batchNum,     setBatchNum]     = useState('')
  const [expiryDate,   setExpiryDate]   = useState('')
  const [comment,      setComment]      = useState('')

  // UI
  const [loading,  setLoading]  = useState(false)
  const [err,      setErr]      = useState('')
  const [success,  setSuccess]  = useState(false)

  const debRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // Labels derived from t() — must be inside component
  const OP_LABELS: Record<OpType, string> = {
    add:     t('ajustement.ops.add'),
    remove:  t('ajustement.ops.remove'),
    correct: t('ajustement.ops.correct'),
  }

  const TARGET_OPTIONS: Record<OpType, Array<{ value: TargetType; label: string }>> = {
    add:     [{ value: 'new_batch',      label: t('ajustement.targets.new_batch')      },
               { value: 'existing_batch', label: t('ajustement.targets.existing_batch') }],
    remove:  [{ value: 'global',         label: t('ajustement.targets.global')         },
               { value: 'existing_batch', label: t('ajustement.targets.existing_batch') }],
    correct: [{ value: 'global',         label: t('ajustement.targets.global')         },
               { value: 'existing_batch', label: t('ajustement.targets.existing_batch') }],
  }

  // Load warehouses
  useEffect(() => {
    fetch('/api/warehouses', { headers: authHdr() })
      .then(r => r.json())
      .then(d => setWarehouses(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // Product search debounce
  useEffect(() => {
    if (product || productQuery.length < 2) { setProdResults([]); setShowDrop(false); return }
    if (debRef.current) clearTimeout(debRef.current)
    debRef.current = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(productQuery)}&limit=10`, { headers: authHdr() })
        .then(r => r.json())
        .then(d => { const items = d.items ?? []; setProdResults(items); setShowDrop(items.length > 0) })
        .catch(() => {})
    }, 300)
  }, [productQuery, product])

  // Load variants when product selected
  useEffect(() => {
    if (!product) { setVariants([]); setVariantId(''); return }
    fetch(`/api/products/${product.id}`, { headers: authHdr() })
      .then(r => r.json())
      .then(d => { const vs = ((d.product_variants ?? []) as Variant[]).filter(v => v.is_active); setVariants(vs); setVariantId('') })
      .catch(() => {})
  }, [product])

  // Reset default target when operation changes
  useEffect(() => {
    setTarget(op === 'add' ? 'new_batch' : 'global')
    setBatchId('')
    setBatches([])
  }, [op])

  // Load batches when step 2 + existing_batch selected
  useEffect(() => {
    if (step !== 2 || target !== 'existing_batch' || !product || !warehouseId) { setBatches([]); setBatchId(''); return }
    const qs = new URLSearchParams({ product_id: product.id, warehouse_id: warehouseId })
    if (variantId) qs.set('variant_id', variantId)
    fetch(`/api/stock/batches?${qs}`, { headers: authHdr() })
      .then(r => r.json())
      .then(d => { setBatches(Array.isArray(d) ? d : []); setBatchId('') })
      .catch(() => {})
  }, [step, target, product, warehouseId, variantId])

  // Close product dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function pickProduct(p: Product) {
    setProduct(p); setProductQuery(p.name); setShowDrop(false); setProdResults([])
  }

  function clearProduct() {
    setProduct(null); setProductQuery(''); setVariants([]); setVariantId(''); setProdResults([]); setShowDrop(false)
  }

  function resetForm() {
    setStep(1); setWarehouseId(''); clearProduct(); setOp('add')
    setTarget('new_batch'); setBatches([]); setBatchId('')
    setQuantity(''); setUnitCost(''); setBatchNum(''); setExpiryDate(''); setComment('')
    setErr(''); setSuccess(false)
  }

  function goStep2() {
    if (!warehouseId)                     { setErr(t('ajustement.errWarehouse')); return }
    if (!product)                         { setErr(t('ajustement.errProduct'));   return }
    if (variants.length > 0 && !variantId){ setErr(t('ajustement.errVariant'));   return }
    setErr(''); setStep(2)
  }

  async function submit() {
    if (!quantity || Number(quantity) <= 0)        { setErr(t('ajustement.errQty'));   return }
    if (target === 'existing_batch' && !batchId)   { setErr(t('ajustement.errBatch')); return }
    setErr(''); setLoading(true)
    try {
      const res = await fetch('/api/stock/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHdr() },
        body: JSON.stringify({
          warehouse_id:   warehouseId,
          product_id:     product!.id,
          variant_id:     variantId   || undefined,
          operation_type: op,
          target_type:    target,
          quantity:       Number(quantity),
          unit_cost:      unitCost   ? Number(unitCost)  : undefined,
          batch_id:       batchId    || undefined,
          batch_number:   batchNum   || undefined,
          expiry_date:    expiryDate || undefined,
          comment:        comment    || undefined,
        }),
      })
      const data = await res.json() as { id?: string; error?: string }
      if (!res.ok) { setErr(data.error ?? t('ajustement.errAdjust')); return }
      setSuccess(true)
      setTimeout(() => resetForm(), 2500)
    } catch {
      setErr(t('ajustement.errNetwork'))
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1 render ────────────────────────────────────────────────────────────

  const warehouseName = warehouses.find(w => w.id === warehouseId)?.name

  const step1 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <Select
        label={t('ajustement.warehouseLabel')}
        value={warehouseId}
        onChange={setWarehouseId}
        placeholder={t('ajustement.warehousePh')}
        options={warehouses.map(w => ({ value: w.id, label: w.name }))}
      />

      <div>
        <FieldLabel label={t('ajustement.productLabel')} required />
        <div ref={dropRef} style={{ position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <input
              value={productQuery}
              onChange={e => { setProductQuery(e.target.value); if (product) clearProduct() }}
              onFocus={() => { if (prodResults.length > 0) setShowDrop(true) }}
              placeholder={t('ajustement.productPh')}
              style={{
                width: '100%', boxSizing: 'border-box',
                border: `1px solid ${colors.border}`, borderRadius: 4,
                padding: '7px 30px 7px 10px', fontSize: 13,
                color: colors.text, fontFamily: fonts.sans, outline: 'none', background: '#fff',
              }}
            />
            {product && (
              <button onClick={clearProduct} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: colors.textLt, fontSize: 16, lineHeight: 1, padding: 2 }}>×</button>
            )}
          </div>
          {showDrop && prodResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
              {prodResults.map(p => (
                <div key={p.id} onMouseDown={() => pickProduct(p)}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontFamily: fonts.sans, borderBottom: `1px solid ${colors.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = colors.primaryLt)}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                >
                  <div style={{ fontSize: 13, color: colors.text }}>{p.name}</div>
                  {p.sku && <div style={{ fontSize: 11, color: colors.textLt, marginTop: 1 }}>SKU: {p.sku}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {variants.length > 0 && (
        <Select
          label={t('ajustement.variantLabel')}
          value={variantId}
          onChange={setVariantId}
          placeholder={t('ajustement.variantPh')}
          options={variants.map(v => ({ value: v.id, label: v.sku + (v.price ? ` — ${v.price.toLocaleString('fr-DZ')} DA` : '') }))}
        />
      )}

      <div>
        <FieldLabel label={t('ajustement.operationLabel')} required />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['add', 'remove', 'correct'] as OpType[]).map(o => (
            <RadioBtn key={o} label={OP_LABELS[o]} checked={op === o} onChange={() => setOp(o)} />
          ))}
        </div>
      </div>

      {err && <ErrBanner msg={err} />}

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
        <Button onClick={goStep2}>{t('common:actions.confirm')} →</Button>
      </div>
    </div>
  )

  // ── Step 2 render ────────────────────────────────────────────────────────────

  const batchOptions = batches.map(b => ({
    value: b.id,
    label: [
      b.batch_number ? `${t('ajustement.batchLabel')} ${b.batch_number}` : t('ajustement.batchLabel'),
      `Qté: ${b.quantity}`,
      b.expiry_date ? `Exp: ${fmtDate(b.expiry_date)}` : null,
    ].filter(Boolean).join(' · '),
  }))

  const showExistingBatch  = target === 'existing_batch'
  const showNewBatchFields = op === 'add'     && target === 'new_batch'
  const showCorrectGlobal  = op === 'correct' && target === 'global'

  const step2 = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <div style={{ padding: '10px 14px', borderRadius: 6, background: colors.primaryLt, border: `1px solid ${colors.border}`, fontSize: 13, fontFamily: fonts.sans, color: colors.text, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {warehouseName && <span><strong>{t('ajustement.warehouseLabel')}:</strong> {warehouseName}</span>}
        {product && <span><strong>{t('ajustement.productLabel')}:</strong> {product.name}</span>}
        {variantId && <span><strong>{t('ajustement.variantLabel')}:</strong> {variants.find(v => v.id === variantId)?.sku}</span>}
        <span><strong>{t('ajustement.operationLabel')}:</strong> {OP_LABELS[op]}</span>
      </div>

      <div>
        <FieldLabel label={t('ajustement.targetLabel')} required />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TARGET_OPTIONS[op].map(tgt => (
            <RadioBtn key={tgt.value} label={tgt.label} checked={target === tgt.value} onChange={() => { setTarget(tgt.value); setBatchId('') }} />
          ))}
        </div>
      </div>

      {showExistingBatch && (
        <Select
          label={t('ajustement.batchLabel')}
          value={batchId}
          onChange={setBatchId}
          placeholder={batches.length === 0 ? t('ajustement.noBatch') : t('ajustement.batchPh')}
          options={batchOptions}
          disabled={batches.length === 0}
        />
      )}

      <Input
        label={showCorrectGlobal ? t('ajustement.qtyTargetLabel') : t('ajustement.qtyLabel')}
        value={quantity}
        onChange={setQuantity}
        type="number"
        placeholder="0"
        required
      />

      {(showNewBatchFields || showCorrectGlobal) && (
        <>
          <Input label={t('ajustement.unitCostLabel')} value={unitCost} onChange={setUnitCost} type="number" placeholder="0" />
          <Input label={t('ajustement.batchNumberLabel')} value={batchNum} onChange={setBatchNum} placeholder={t('ajustement.batchNumberPh')} />
          <Input label={t('ajustement.expiryLabel')} value={expiryDate} onChange={setExpiryDate} type="date" />
          <Input label={t('ajustement.commentLabel')} value={comment} onChange={setComment} placeholder={t('ajustement.commentPh')} />
        </>
      )}

      {err && <ErrBanner msg={err} />}

      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <Button variant="secondary" onClick={() => { setStep(1); setErr('') }}>← {t('common:actions.cancel')}</Button>
        <Button onClick={submit} loading={loading}>{t('ajustement.submitBtn')}</Button>
      </div>
    </div>
  )

  // ── Success banner ───────────────────────────────────────────────────────────

  const successBanner = (
    <div style={{ padding: '16px 20px', borderRadius: 8, background: '#f0fff4', border: `1px solid ${colors.green}`, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontFamily: fonts.sans, color: colors.green }}>
      <Check size={18} strokeWidth={2.5} />
      {t('ajustement.successTitle')}
    </div>
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title={t('ajustement.title')}
        subtitle={t('ajustement.subtitle')}
      />

      <div style={{ padding: 24, maxWidth: 600 }}>
        <Card>
          <StepIndicator step={step} labels={t('ajustement.steps', { returnObjects: true }) as string[]} />
          {success ? successBanner : step === 1 ? step1 : step2}
        </Card>
      </div>
    </>
  )
}
