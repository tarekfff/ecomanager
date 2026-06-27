'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle, XCircle, ChevronDown, ChevronUp,
  AlertCircle, ArrowLeft, Link, RefreshCw, Loader2,
} from 'lucide-react'
import { PageHeader, Button } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'
import { useBoutique } from '@/contexts/BoutiqueContext'

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

interface Mapping {
  order_ref:       string
  client_name:     string
  phone:           string
  email:           string
  phone2:          string
  wilaya:          string
  commune:         string
  address:         string
  remark:          string
  delivery_method: string
  product_sku:     string
  quantity:        string
  unit_price:      string
  ip_address:      string
  referrer:        string
}

interface ImportResult {
  imported: number
  skipped:  number
  failed:   number
  errors:   { row: number; reason: string }[]
}

interface MappingFieldDef {
  key:      keyof Mapping
  label:    string
  required: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

const EMPTY_MAPPING: Mapping = {
  order_ref: '', client_name: '', phone: '', email: '', phone2: '',
  wilaya: '', commune: '', address: '', remark: '', delivery_method: '',
  product_sku: '', quantity: '', unit_price: '', ip_address: '', referrer: '',
}

const MAPPING_FIELDS: MappingFieldDef[] = [
  { key: 'order_ref',       label: 'N° commande',       required: false },
  { key: 'client_name',     label: 'Client',             required: true  },
  { key: 'phone',           label: 'Téléphone',          required: true  },
  { key: 'email',           label: 'Email',              required: false },
  { key: 'phone2',          label: 'Tél 2',              required: false },
  { key: 'wilaya',          label: 'Wilaya',             required: true  },
  { key: 'commune',         label: 'Commune',            required: true  },
  { key: 'address',         label: 'Adresse',            required: false },
  { key: 'remark',          label: 'Remarque',           required: false },
  { key: 'delivery_method', label: 'Méthode livraison',  required: false },
  { key: 'product_sku',     label: 'Produit (SKU)',      required: true  },
  { key: 'quantity',        label: 'Quantité',           required: true  },
  { key: 'unit_price',      label: 'Prix unitaire',      required: false },
  { key: 'ip_address',      label: 'Adresse IP',         required: false },
  { key: 'referrer',        label: 'Référent',           required: false },
]

const STEP_LABELS = ['Connexion Google', 'Sélection fichier', 'Mapping colonnes', 'Import']

const DEFAULT_SEPARATOR = '|'

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractSheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return m ? m[1] : input.trim()
}

function autoDetect(headers: string[]): Mapping {
  function find(variants: string[]): string {
    const lower = headers.map(h => h.toLowerCase())
    for (const v of variants) {
      const idx = lower.findIndex(h => h.includes(v))
      if (idx >= 0) return headers[idx]
    }
    return ''
  }
  return {
    order_ref:       find(['n° commande', 'commande', 'référence', 'reference', 'order', 'ref']),
    client_name:     find(['client', 'nom', 'name', 'full_name']),
    phone:           find(['téléphone', 'telephone', 'phone', 'tel', 'gsm', 'mobile']),
    email:           find(['email', 'mail', 'e-mail']),
    phone2:          find(['tél 2', 'tel2', 'phone2', 'mobile 2', 'gsm2', 'téléphone 2']),
    wilaya:          find(['wilaya', 'province', 'état', 'etat']),
    commune:         find(['commune', 'ville', 'city', 'daïra']),
    address:         find(['adresse', 'address', 'addr']),
    remark:          find(['remarque', 'remark', 'note', 'observation']),
    delivery_method: find(['livraison', 'méthode', 'methode', 'delivery', 'mode']),
    product_sku:     find(['sku', 'produit', 'product', 'article', 'référence produit']),
    quantity:        find(['quantité', 'quantity', 'qté', 'qty']),
    unit_price:      find(['prix', 'price', 'tarif', 'montant', 'unit']),
    ip_address:      find(['ip', 'adresse ip']),
    referrer:        find(['référent', 'referrer', 'source', 'canal']),
  }
}

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, fontFamily: fonts.sans }}>
      {STEP_LABELS.map((label, i) => {
        const n      = (i + 1) as Step
        const done   = step > n
        const active = step === n
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 0 }}>
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
            {i < 3 && (
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

function FieldRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: `1px solid ${colors.border}` }}>
      <div style={{ width: 180, fontSize: 12.5, color: colors.text, flexShrink: 0 }}>
        {label}
        {required && <span style={{ color: colors.red, marginLeft: 3 }}>*</span>}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function GoogleSheetImportPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { boutiqueId } = useBoutique()

  const [step,         setStep]         = useState<Step>(1)
  const [googleToken,  setGoogleToken]  = useState('')
  const [googleEmail,  setGoogleEmail]  = useState('')
  const [googleError,  setGoogleError]  = useState('')

  // Step 2
  const [sheetInput,   setSheetInput]   = useState('')
  const [sheetName,    setSheetName]    = useState('')
  const [separator,    setSeparator]    = useState(DEFAULT_SEPARATOR)
  const [loadError,    setLoadError]    = useState('')
  const [loadLoading,  setLoadLoading]  = useState(false)

  // Step 3
  const [headers,      setHeaders]      = useState<string[]>([])
  const [preview,      setPreview]      = useState<string[][]>([])
  const [mapping,      setMapping]      = useState<Mapping>(EMPTY_MAPPING)
  const [mappingError, setMappingError] = useState('')

  // Step 4
  const [result,       setResult]       = useState<ImportResult | null>(null)
  const [importing,    setImporting]    = useState(false)
  const [errorsOpen,   setErrorsOpen]   = useState(false)

  // ── Pick up OAuth result from URL params ──────────────────────────────────

  useEffect(() => {
    const token = searchParams.get('google_token')
    const email = searchParams.get('google_email')
    const err   = searchParams.get('google_error')

    if (token) {
      setGoogleToken(token)
      setGoogleEmail(email ?? '')
      setStep(2)
      // Clean URL
      router.replace('/dashboard/orders/import/google-sheet')
    }
    if (err) {
      setGoogleError(
        err === 'access_denied' ? 'Accès refusé par Google.' : `Erreur d'authentification (${err}).`
      )
      router.replace('/dashboard/orders/import/google-sheet')
    }

    // Restore persisted token from localStorage
    const saved      = localStorage.getItem('google_oauth_token')
    const savedEmail = localStorage.getItem('google_oauth_email')
    if (!token && saved) {
      setGoogleToken(saved)
      setGoogleEmail(savedEmail ?? '')
      setStep(2)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist token when set via OAuth redirect
  useEffect(() => {
    if (googleToken) {
      localStorage.setItem('google_oauth_token', googleToken)
      localStorage.setItem('google_oauth_email', googleEmail)
    }
  }, [googleToken, googleEmail])

  // ── Step 1 — connect ─────────────────────────────────────────────────────

  function handleConnectGoogle() {
    window.location.href = '/api/auth/google?return_to=/dashboard/orders/import/google-sheet'
  }

  function handleDisconnect() {
    localStorage.removeItem('google_oauth_token')
    localStorage.removeItem('google_oauth_email')
    setGoogleToken('')
    setGoogleEmail('')
    setStep(1)
  }

  // ── Step 2 — load sheet ───────────────────────────────────────────────────

  const handleLoadSheet = useCallback(async () => {
    if (!sheetInput.trim()) { setLoadError('Entrez l\'URL ou l\'ID de la feuille.'); return }
    if (!googleToken)        { setLoadError('Connectez-vous à Google d\'abord.'); return }

    setLoadError('')
    setLoadLoading(true)

    const sheetId = extractSheetId(sheetInput)
    const tabName = sheetName.trim() || 'Sheet1'

    try {
      const res = await fetch(
        `/api/orders/import/google-sheet/preview?sheet_id=${encodeURIComponent(sheetId)}&sheet_name=${encodeURIComponent(tabName)}&google_token=${encodeURIComponent(googleToken)}`,
        { headers: authHeader() }
      )
      const data = await res.json() as { headers?: string[]; rows?: string[][]; error?: string }

      if (!res.ok || data.error) {
        if (data.error?.includes('401') || data.error?.includes('invalid_token')) {
          // Token expired — clear and re-authenticate
          handleDisconnect()
          setLoadError('Session Google expirée. Veuillez vous reconnecter.')
        } else {
          setLoadError(data.error ?? 'Impossible de charger la feuille.')
        }
        return
      }

      setHeaders(data.headers ?? [])
      setPreview(data.rows ?? [])
      setMapping(autoDetect(data.headers ?? []))
      setMappingError('')
      setStep(3)
    } catch {
      setLoadError('Erreur réseau.')
    } finally {
      setLoadLoading(false)
    }
  }, [sheetInput, sheetName, googleToken])

  // ── Step 3 → 4 — import ──────────────────────────────────────────────────

  async function handleImport() {
    const required = MAPPING_FIELDS.filter(f => f.required)
    for (const f of required) {
      if (!mapping[f.key]) {
        setMappingError(`Veuillez mapper le champ requis : "${f.label}"`)
        return
      }
    }
    if (!boutiqueId) { setMappingError('Sélectionnez une boutique.'); return }
    setMappingError('')
    setStep(4)
    setImporting(true)

    try {
      const sheetId = extractSheetId(sheetInput)
      const res = await fetch('/api/orders/import/google-sheet', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body:    JSON.stringify({
          sheet_id:     sheetId,
          sheet_name:   sheetName.trim() || 'Sheet1',
          separator,
          boutique_id:  boutiqueId,
          google_token: googleToken,
          mapping,
        }),
      })
      const data = await res.json() as ImportResult
      setResult(data)
    } catch {
      setResult({ imported: 0, skipped: 0, failed: 0, errors: [{ row: 0, reason: 'Erreur réseau' }] })
    } finally {
      setImporting(false)
    }
  }

  // ── Input style helpers ───────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: `1px solid ${colors.border}`, borderRadius: 5,
    padding: '8px 11px', fontSize: 13, fontFamily: fonts.sans,
    color: colors.text, outline: 'none', background: '#fff',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle, cursor: 'pointer', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23999'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
    paddingRight: 28,
  }

  const colOptions = [
    <option key="" value="">— Ignorer —</option>,
    ...headers.map(h => <option key={h} value={h}>{h}</option>),
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Import Google Sheet"
        subtitle="Importer des commandes depuis une feuille Google Sheets"
        actions={
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft size={14} style={{ marginRight: 4 }} />
            Retour
          </Button>
        }
      />

      <div style={{
        flex: 1, overflowY: 'auto', padding: 24,
        fontFamily: fonts.sans, background: colors.bg,
      }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <StepIndicator step={step} />

          {/* ── Step 1 — Connexion Google ────────────────────────────────── */}
          {step === 1 && (
            <Card>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: '0 0 6px' }}>
                Connexion Google
              </h2>
              <p style={{ fontSize: 13, color: colors.textMd, margin: '0 0 24px' }}>
                Autorisez l&apos;accès en lecture seule à vos Google Sheets pour importer des commandes.
              </p>

              {googleError && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#fff0f0', border: `1px solid ${colors.red}33`,
                  borderRadius: 6, padding: '10px 14px', marginBottom: 16,
                  fontSize: 13, color: colors.red,
                }}>
                  <AlertCircle size={15} />
                  {googleError}
                </div>
              )}

              <button
                onClick={handleConnectGoogle}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 20px', borderRadius: 7,
                  border: `1px solid ${colors.border}`,
                  background: '#fff', cursor: 'pointer',
                  fontSize: 14, fontWeight: 500, fontFamily: fonts.sans,
                  color: colors.text, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  transition: 'box-shadow .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)')}
              >
                {/* Google logo SVG */}
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Connecter mon compte Google
              </button>
            </Card>
          )}

          {/* ── Step 2 — Sélection fichier ───────────────────────────────── */}
          {step === 2 && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: 0 }}>
                    Sélection du fichier
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', background: colors.green,
                    }} />
                    <span style={{ fontSize: 12, color: colors.textMd }}>
                      Connecté en tant que <strong>{googleEmail}</strong>
                    </span>
                    <button
                      onClick={handleDisconnect}
                      style={{
                        fontSize: 11, color: colors.textLt, background: 'none', border: 'none',
                        cursor: 'pointer', textDecoration: 'underline', padding: 0, marginLeft: 4,
                      }}
                    >
                      Déconnecter
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: colors.textMd, display: 'block', marginBottom: 5 }}>
                    URL ou ID de la feuille Google Sheets <span style={{ color: colors.red }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Link size={14} color={colors.textLt} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      value={sheetInput}
                      onChange={e => setSheetInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/… ou ID direct"
                      style={{ ...inputStyle, paddingLeft: 32 }}
                      onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
                      onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: colors.textMd, display: 'block', marginBottom: 5 }}>
                      Nom de l&apos;onglet (feuille)
                    </label>
                    <input
                      value={sheetName}
                      onChange={e => setSheetName(e.target.value)}
                      placeholder="Sheet1"
                      style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
                      onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: colors.textMd, display: 'block', marginBottom: 5 }}>
                      Séparateur produits
                    </label>
                    <input
                      value={separator}
                      onChange={e => setSeparator(e.target.value || DEFAULT_SEPARATOR)}
                      placeholder="|"
                      maxLength={5}
                      style={{ ...inputStyle, width: 80 }}
                      onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
                      onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
                    />
                    <span style={{ fontSize: 11, color: colors.textLt, marginTop: 4, display: 'block' }}>
                      Sépare plusieurs SKUs dans une cellule
                    </span>
                  </div>
                </div>

                {loadError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#fff0f0', border: `1px solid ${colors.red}33`,
                    borderRadius: 6, padding: '10px 14px', fontSize: 13, color: colors.red,
                  }}>
                    <AlertCircle size={15} />
                    {loadError}
                  </div>
                )}

                <div>
                  <button
                    onClick={handleLoadSheet}
                    disabled={loadLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 18px', borderRadius: 6, border: 'none',
                      background: loadLoading ? '#ccc' : colors.primary,
                      color: '#fff', fontSize: 13, fontWeight: 600,
                      fontFamily: fonts.sans, cursor: loadLoading ? 'not-allowed' : 'pointer',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => { if (!loadLoading) (e.currentTarget as HTMLButtonElement).style.background = colors.primaryDk }}
                    onMouseLeave={e => { if (!loadLoading) (e.currentTarget as HTMLButtonElement).style.background = colors.primary }}
                  >
                    {loadLoading
                      ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      : <RefreshCw size={14} />
                    }
                    {loadLoading ? 'Chargement…' : 'Charger la feuille'}
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* ── Step 3 — Mapping colonnes ────────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Preview table */}
              {preview.length > 0 && (
                <Card>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: colors.textMd, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Aperçu (3 premières lignes)
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 500 }}>
                      <thead>
                        <tr>
                          {headers.map(h => (
                            <th key={h} style={{
                              fontSize: 11, fontWeight: 600, color: colors.textLt,
                              padding: '5px 10px', background: '#f5f5f5',
                              border: `1px solid ${colors.border}`,
                              textTransform: 'uppercase', letterSpacing: '0.5px',
                              whiteSpace: 'nowrap',
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.slice(0, 3).map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td key={ci} style={{
                                fontSize: 12, padding: '5px 10px', color: colors.text,
                                border: `1px solid ${colors.border}`, whiteSpace: 'nowrap',
                                maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {cell || <span style={{ color: colors.textLt }}>—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* Mapping */}
              <Card>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: colors.textMd, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Correspondance des colonnes
                </h3>
                <p style={{ fontSize: 12, color: colors.textLt, margin: '0 0 16px' }}>
                  Associez chaque champ de la commande à une colonne de votre feuille.
                </p>

                <div>
                  {/* Header row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0',
                    borderBottom: `1px solid ${colors.border}`,
                  }}>
                    <div style={{ width: 180, fontSize: 11, fontWeight: 600, color: colors.textLt, textTransform: 'uppercase' }}>
                      Champ
                    </div>
                    <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: colors.textLt, textTransform: 'uppercase' }}>
                      Colonne dans la feuille
                    </div>
                  </div>

                  {MAPPING_FIELDS.map(field => (
                    <FieldRow key={field.key} label={field.label} required={field.required}>
                      <select
                        value={mapping[field.key]}
                        onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                        style={selectStyle}
                        onFocus={e => (e.currentTarget.style.borderColor = colors.primary)}
                        onBlur={e  => (e.currentTarget.style.borderColor = colors.border)}
                      >
                        {colOptions}
                      </select>
                    </FieldRow>
                  ))}
                </div>

                {mappingError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
                    background: '#fff0f0', border: `1px solid ${colors.red}33`,
                    borderRadius: 6, padding: '10px 14px', fontSize: 13, color: colors.red,
                  }}>
                    <AlertCircle size={15} />
                    {mappingError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button
                    onClick={() => setStep(2)}
                    style={{
                      padding: '8px 16px', borderRadius: 6, border: `1px solid ${colors.border}`,
                      background: '#fff', color: colors.textMd, fontSize: 13,
                      fontFamily: fonts.sans, cursor: 'pointer',
                    }}
                  >
                    Retour
                  </button>
                  <button
                    onClick={handleImport}
                    style={{
                      padding: '8px 20px', borderRadius: 6, border: 'none',
                      background: colors.primary, color: '#fff',
                      fontSize: 13, fontWeight: 600, fontFamily: fonts.sans, cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = colors.primaryDk}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = colors.primary}
                  >
                    Lancer l&apos;import →
                  </button>
                </div>
              </Card>
            </div>
          )}

          {/* ── Step 4 — Import / Résultat ───────────────────────────────── */}
          {step === 4 && (
            <Card>
              {importing ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <Loader2 size={32} color={colors.primary} style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
                  <div style={{ fontSize: 14, color: colors.textMd }}>Import en cours…</div>
                  <div style={{ fontSize: 12, color: colors.textLt, marginTop: 6 }}>
                    Lecture de la feuille et création des commandes
                  </div>
                </div>
              ) : result ? (
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: colors.text, margin: '0 0 20px' }}>
                    Résultat de l&apos;import
                  </h2>

                  {/* Summary cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                    {[
                      { label: 'Importées',  value: result.imported, color: colors.green  },
                      { label: 'Ignorées',   value: result.skipped,  color: colors.blue   },
                      { label: 'Échouées',   value: result.failed,   color: colors.red    },
                      { label: 'Total',      value: result.imported + result.skipped + result.failed, color: colors.textMd },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{
                        textAlign: 'center', padding: '16px 8px',
                        border: `1px solid ${colors.border}`, borderRadius: 8,
                        background: '#fafafa',
                      }}>
                        <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
                        <div style={{ fontSize: 12, color: colors.textMd, marginTop: 4 }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {result.imported > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
                      background: '#f0fdf4', border: `1px solid ${colors.green}44`,
                      borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#166534',
                    }}>
                      <CheckCircle size={15} />
                      {result.imported} commande{result.imported > 1 ? 's' : ''} créée{result.imported > 1 ? 's' : ''} avec succès.
                    </div>
                  )}

                  {result.errors.length > 0 && (
                    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 6, overflow: 'hidden' }}>
                      <button
                        onClick={() => setErrorsOpen(v => !v)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '10px 14px', border: 'none',
                          background: '#fff8f8', cursor: 'pointer', fontFamily: fonts.sans,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: colors.red, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <XCircle size={14} />
                          {result.errors.length} erreur{result.errors.length > 1 ? 's' : ''}
                        </span>
                        {errorsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {errorsOpen && (
                        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                          {result.errors.map((e, i) => (
                            <div key={i} style={{
                              padding: '7px 14px', fontSize: 12, color: colors.text,
                              borderTop: `1px solid ${colors.border}`,
                              display: 'flex', gap: 10,
                            }}>
                              <span style={{ color: colors.textLt, flexShrink: 0, minWidth: 52 }}>
                                Ligne {e.row}
                              </span>
                              <span>{e.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                    <button
                      onClick={() => { setStep(2); setResult(null) }}
                      style={{
                        padding: '8px 16px', borderRadius: 6, border: `1px solid ${colors.border}`,
                        background: '#fff', color: colors.textMd, fontSize: 13,
                        fontFamily: fonts.sans, cursor: 'pointer',
                      }}
                    >
                      Nouvel import
                    </button>
                    <button
                      onClick={() => router.push('/dashboard/orders/en-confirmation')}
                      style={{
                        padding: '8px 20px', borderRadius: 6, border: 'none',
                        background: colors.primary, color: '#fff',
                        fontSize: 13, fontWeight: 600, fontFamily: fonts.sans, cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = colors.primaryDk}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = colors.primary}
                    >
                      Voir les commandes →
                    </button>
                  </div>
                </div>
              ) : null}
            </Card>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
