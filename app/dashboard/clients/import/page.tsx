'use client'
import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import {
  Upload, CheckCircle, XCircle, ChevronDown, ChevronUp,
  AlertCircle, FileSpreadsheet, ArrowLeft, Download,
} from 'lucide-react'
import { PageHeader, Button } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4

interface Mapping {
  full_name:    string
  phone:        string
  wilaya_name:  string
  commune_name: string
  email:        string
  address:      string
  phone2:       string
}

interface ImportResult {
  imported: number
  failed:   number
  errors:   { row: number; reason: string }[]
}

interface MappingFieldDef {
  key:      keyof Mapping
  label:    string
  required: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────

const EMPTY_MAPPING: Mapping = {
  full_name: '', phone: '', wilaya_name: '', commune_name: '',
  email: '', address: '', phone2: '',
}

const MAPPING_FIELDS: MappingFieldDef[] = [
  { key: 'full_name',    label: 'Nom complet',  required: true  },
  { key: 'phone',        label: 'Téléphone',    required: true  },
  { key: 'wilaya_name',  label: 'Wilaya',       required: true  },
  { key: 'commune_name', label: 'Commune',      required: true  },
  { key: 'email',        label: 'Email',        required: false },
  { key: 'address',      label: 'Adresse',      required: false },
  { key: 'phone2',       label: 'Téléphone 2',  required: false },
]

const ACCEPTED = '.xls,.xlsx,.csv'

const STEP_LABELS = ['Fichier', 'Correspondance', 'Import', 'Résultat']

// ── Helpers ────────────────────────────────────────────────────────────────

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
    full_name:    find(['nom complet', 'nom client', 'full_name', 'client', 'nom', 'name']),
    phone:        find(['téléphone', 'telephone', 'phone', 'mobile', 'gsm', 'tel']),
    wilaya_name:  find(['wilaya', 'province', 'état', 'etat']),
    commune_name: find(['commune', 'ville', 'city', 'daïra', 'daira']),
    email:        find(['email', 'mail', 'e-mail', 'courriel']),
    address:      find(['adresse', 'address', 'addr']),
    phone2:       find(['téléphone 2', 'telephone 2', 'phone2', 'tel2', 'mobile 2', 'gsm2']),
  }
}

async function parseFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const ab  = await file.arrayBuffer()
  const wb  = XLSX.read(ab, { type: 'array' })
  const ws  = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' })

  if (!raw || raw.length < 2) throw new Error('Fichier vide ou sans données')

  const headers = (raw[0] as unknown[]).map(h => String(h ?? '').trim()).filter(Boolean)
  if (headers.length === 0) throw new Error('Aucune colonne détectée dans le fichier')

  const rows = (raw.slice(1) as unknown[][])
    .map(row => headers.map((_, i) => String((row as unknown[])[i] ?? '').trim()))
    .filter(row => row.some(cell => cell !== ''))

  return { headers, rows }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, fontFamily: fonts.sans }}>
      {STEP_LABELS.map((label, i) => {
        const n     = (i + 1) as Step
        const done  = step > n
        const active = step === n
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: done ? colors.green : active ? colors.primary : '#ddd',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
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
              <div style={{
                flex: 1, height: 1, margin: '0 10px',
                background: done ? colors.green : '#ddd',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', border: `1px solid ${colors.border}`,
      borderRadius: 8, padding: 28,
    }}>
      {children}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ImportClientsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step,         setStep]         = useState<Step>(1)
  const [dragOver,     setDragOver]     = useState(false)
  const [file,         setFile]         = useState<File | null>(null)
  const [parseError,   setParseError]   = useState('')
  const [headers,      setHeaders]      = useState<string[]>([])
  const [rows,         setRows]         = useState<string[][]>([])
  const [mapping,      setMapping]      = useState<Mapping>(EMPTY_MAPPING)
  const [mappingError, setMappingError] = useState('')
  const [result,       setResult]       = useState<ImportResult | null>(null)
  const [errorsOpen,   setErrorsOpen]   = useState(false)

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (f: File | null | undefined) => {
    if (!f) return
    setParseError('')
    setFile(f)
    try {
      const { headers: hdrs, rows: dataRows } = await parseFile(f)
      setHeaders(hdrs)
      setRows(dataRows)
      setMapping(autoDetect(hdrs))
      setMappingError('')
      setStep(2)
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Impossible de lire le fichier.')
    }
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files[0])
  }

  // ── Template download ─────────────────────────────────────────────────────

  function downloadTemplate() {
    const templateRows = [
      // Header row — names match autoDetect variants so mapping is pre-filled
      ['Nom complet', 'Téléphone', 'Téléphone 2', 'Email', 'Wilaya', 'Commune', 'Adresse'],
      // Example rows with realistic Algerian data
      ['Ahmed Benali',   '0555 12 34 56', '0661 98 76 54', 'ahmed@example.com',  'Alger',      'Bab Ezzouar', 'Rue des Frères Bouadou, Cité Garidi'],
      ['Fatima Kaci',    '0770 11 22 33', '',              '',                   'Oran',       'Bir El Djir', ''],
      ['Mohamed Amrani', '0661 44 55 66', '',              'm.amrani@gmail.com', 'Constantine', 'El Khroub',  'Avenue Zighoud Youcef'],
    ]

    const ws = XLSX.utils.aoa_to_sheet(templateRows)
    ws['!cols'] = [
      { wch: 22 }, // Nom complet
      { wch: 16 }, // Téléphone
      { wch: 16 }, // Téléphone 2
      { wch: 26 }, // Email
      { wch: 14 }, // Wilaya
      { wch: 16 }, // Commune
      { wch: 36 }, // Adresse
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clients')
    XLSX.writeFile(wb, 'modele_import_clients.xlsx')
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    // Validate required mappings are selected
    const required = MAPPING_FIELDS.filter(f => f.required)
    for (const f of required) {
      if (!mapping[f.key]) {
        setMappingError(`Veuillez mapper le champ requis : "${f.label}"`)
        return
      }
    }
    setMappingError('')
    setStep(3)

    const token = localStorage.getItem('token') ?? ''

    const importRows = rows.map(row => {
      function get(key: keyof Mapping): string | null {
        const col = mapping[key]
        if (!col) return null
        const idx = headers.indexOf(col)
        const val = idx >= 0 ? row[idx] : ''
        return val || null
      }
      return {
        full_name:    get('full_name')    ?? '',
        phone:        get('phone')        ?? '',
        phone2:       get('phone2'),
        email:        get('email'),
        wilaya_name:  get('wilaya_name')  ?? '',
        commune_name: get('commune_name') ?? '',
        address:      get('address'),
      }
    })

    try {
      const res  = await fetch('/api/clients/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rows: importRows }),
      })
      const data = await res.json() as ImportResult
      setResult(data)
    } catch {
      setResult({ imported: 0, failed: rows.length, errors: [{ row: 0, reason: 'Erreur réseau' }] })
    }
    setStep(4)
  }

  // ── Column select options ──────────────────────────────────────────────────

  const colOptions = [
    <option key="" value="">— Ignorer ce champ —</option>,
    ...headers.map(h => <option key={h} value={h}>{h}</option>),
  ]

  // ── Step renders ──────────────────────────────────────────────────────────

  const stepUpload = (
    <Card>
      <p style={{ fontSize: 13, color: colors.textMd, marginBottom: 20, fontFamily: fonts.sans }}>
        Importez vos clients depuis un fichier Excel ou CSV. Les colonnes seront associées manuellement.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? colors.primary : colors.border}`,
          borderRadius: 8, padding: '44px 24px', textAlign: 'center',
          cursor: 'pointer', transition: 'all 0.18s',
          background: dragOver ? colors.primaryLt : '#fafafa',
        }}
      >
        <div style={{ pointerEvents: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: dragOver ? colors.primaryLt : '#f0f0f0',
            }}>
              <FileSpreadsheet size={26} color={dragOver ? colors.primary : colors.textLt} />
            </div>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 4, fontFamily: fonts.sans }}>
            Glissez-déposez votre fichier ici
          </p>
          <p style={{ fontSize: 12.5, color: colors.textMd, marginBottom: 16, fontFamily: fonts.sans }}>
            ou cliquez pour parcourir vos fichiers
          </p>
          <span style={{
            display: 'inline-block', fontSize: 11, color: colors.textLt,
            border: `1px solid ${colors.border}`, borderRadius: 4,
            padding: '3px 10px', fontFamily: fonts.sans,
          }}>
            XLS · XLSX · CSV
          </span>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        style={{ display: 'none' }}
        onChange={e => handleFileSelect(e.target.files?.[0])}
      />

      {/* Buttons row: Browse + Download template */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 10 }}>
        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload size={13} style={{ marginRight: 5 }} /> Parcourir
        </Button>
        <Button variant="secondary" size="sm" onClick={downloadTemplate}>
          <Download size={13} style={{ marginRight: 5 }} /> Télécharger le modèle
        </Button>
      </div>

      {/* Template hint */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        marginTop: 20, padding: '12px 16px', borderRadius: 6,
        background: '#f0f7ff', border: '1px solid #c8dffe',
        fontFamily: fonts.sans,
      }}>
        <FileSpreadsheet size={20} color="#4472C4" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: colors.text, margin: 0 }}>
            Vous ne savez pas quel format utiliser ?
          </p>
          <p style={{ fontSize: 12, color: colors.textMd, margin: '2px 0 0' }}>
            Téléchargez le modèle Excel — il contient les bonnes colonnes et 3 lignes d&apos;exemple.
            Les colonnes <strong>Nom complet</strong>, <strong>Téléphone</strong>, <strong>Wilaya</strong> et <strong>Commune</strong> sont obligatoires.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            flexShrink: 0, padding: '7px 14px', borderRadius: 5,
            border: '1px solid #4472C4', background: '#4472C4',
            color: '#fff', fontSize: 12.5, fontWeight: 500,
            cursor: 'pointer', fontFamily: fonts.sans,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#3360b0')}
          onMouseLeave={e => (e.currentTarget.style.background = '#4472C4')}
        >
          <Download size={13} /> Modèle .xlsx
        </button>
      </div>

      {file && !parseError && (
        <p style={{ fontSize: 12, color: colors.textMd, textAlign: 'center', marginTop: 12, fontFamily: fonts.sans }}>
          Fichier sélectionné : <strong>{file.name}</strong>
        </p>
      )}

      {parseError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
          padding: '10px 14px', borderRadius: 6,
          background: '#fff5f5', border: '1px solid #fcc',
        }}>
          <AlertCircle size={15} color={colors.red} />
          <span style={{ fontSize: 12.5, color: colors.red, fontFamily: fonts.sans }}>{parseError}</span>
        </div>
      )}
    </Card>
  )

  const stepMapping = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Preview table */}
      <Card>
        <p style={{ fontSize: 12.5, color: colors.textMd, marginBottom: 12, fontFamily: fonts.sans }}>
          <strong style={{ color: colors.text }}>Aperçu</strong> — 5 premières lignes de «{file?.name}» ({rows.length} ligne{rows.length !== 1 ? 's' : ''} au total)
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, fontFamily: fonts.sans }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                {headers.map(h => (
                  <th key={h} style={{
                    padding: '6px 10px', textAlign: 'left',
                    border: `1px solid ${colors.border}`, color: colors.textMd,
                    fontWeight: 600, whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{
                      padding: '5px 10px', border: `1px solid ${colors.border}`,
                      color: colors.text, maxWidth: 160, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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

      {/* Mapping UI */}
      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 4, fontFamily: fonts.sans }}>
          Correspondance des colonnes
        </p>
        <p style={{ fontSize: 12, color: colors.textMd, marginBottom: 18, fontFamily: fonts.sans }}>
          Associez chaque champ de l&apos;application à la colonne correspondante dans votre fichier.
          Les champs marqués d&apos;un <span style={{ color: colors.red }}>*</span> sont obligatoires.
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '10px 24px',
        }}>
          {MAPPING_FIELDS.map(field => (
            <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: colors.textMd, fontFamily: fonts.sans }}>
                {field.label}
                {field.required && <span style={{ color: colors.red, marginLeft: 2 }}>*</span>}
              </label>
              <select
                value={mapping[field.key]}
                onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                style={{
                  border: `1px solid ${colors.border}`, borderRadius: 4,
                  padding: '6px 9px', fontSize: 12.5, fontFamily: fonts.sans,
                  color: mapping[field.key] ? colors.text : colors.textLt,
                  background: '#fff', cursor: 'pointer', outline: 'none',
                }}
              >
                {colOptions}
              </select>
            </div>
          ))}
        </div>

        {mappingError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
            padding: '10px 14px', borderRadius: 6,
            background: '#fff5f5', border: '1px solid #fcc',
          }}>
            <AlertCircle size={14} color={colors.red} />
            <span style={{ fontSize: 12.5, color: colors.red, fontFamily: fonts.sans }}>{mappingError}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
          <Button variant="secondary" size="sm" onClick={() => { setStep(1); setFile(null); setHeaders([]); setRows([]) }}>
            <ArrowLeft size={13} style={{ marginRight: 4 }} /> Retour
          </Button>
          <Button variant="primary" size="sm" onClick={handleImport}>
            Importer {rows.length} client{rows.length !== 1 ? 's' : ''}
          </Button>
        </div>
      </Card>
    </div>
  )

  const stepImporting = (
    <Card>
      <div style={{ textAlign: 'center', padding: '32px 0', fontFamily: fonts.sans }}>
        {/* Spinner */}
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: `4px solid ${colors.primaryLt}`,
          borderTop: `4px solid ${colors.primary}`,
          margin: '0 auto 20px',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
          Import en cours…
        </p>
        <p style={{ fontSize: 12.5, color: colors.textMd }}>
          Insertion de {rows.length} client{rows.length !== 1 ? 's' : ''}. Veuillez patienter.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Card>
  )

  const stepResult = result && (
    <Card>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {/* Imported */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', borderRadius: 8,
          background: '#f0fff4', border: '1px solid #c3e6cb',
        }}>
          <CheckCircle size={28} color={colors.green} />
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: colors.green, fontFamily: fonts.sans, lineHeight: 1 }}>
              {result.imported}
            </div>
            <div style={{ fontSize: 12, color: colors.textMd, fontFamily: fonts.sans, marginTop: 3 }}>
              client{result.imported !== 1 ? 's' : ''} importé{result.imported !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Errors */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px', borderRadius: 8,
          background: result.failed > 0 ? '#fff5f5' : '#f8f8f8',
          border: `1px solid ${result.failed > 0 ? '#f5c6cb' : colors.border}`,
        }}>
          <XCircle size={28} color={result.failed > 0 ? colors.red : colors.textLt} />
          <div>
            <div style={{
              fontSize: 28, fontWeight: 700, fontFamily: fonts.sans, lineHeight: 1,
              color: result.failed > 0 ? colors.red : colors.textLt,
            }}>
              {result.failed}
            </div>
            <div style={{ fontSize: 12, color: colors.textMd, fontFamily: fonts.sans, marginTop: 3 }}>
              erreur{result.failed !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible error list */}
      {result.errors.length > 0 && (
        <div style={{
          border: `1px solid ${colors.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: 20,
        }}>
          <button
            onClick={() => setErrorsOpen(o => !o)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: '#fafafa', border: 'none',
              cursor: 'pointer', fontFamily: fonts.sans, fontSize: 12.5, fontWeight: 500,
              color: colors.textMd,
            }}
          >
            <span>Détail des erreurs ({result.errors.length})</span>
            {errorsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {errorsOpen && (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {result.errors.map((err, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, padding: '8px 14px',
                  borderTop: `1px solid ${colors.border}`,
                  background: i % 2 === 0 ? '#fff' : '#fafafa',
                  fontFamily: fonts.sans,
                }}>
                  <span style={{ fontSize: 11.5, color: colors.textLt, flexShrink: 0, width: 60 }}>
                    {err.row === 0 ? 'Réseau' : `Ligne ${err.row}`}
                  </span>
                  <span style={{ fontSize: 12, color: colors.red }}>{err.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="primary" size="sm" onClick={() => router.push('/dashboard/clients')}>
          Retour à la liste
        </Button>
        {result.imported > 0 || result.failed > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => {
            setStep(1); setFile(null); setHeaders([]); setRows([]); setResult(null)
          }}>
            Nouvel import
          </Button>
        ) : null}
      </div>
    </Card>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Import de clients"
        subtitle="Importer des clients depuis un fichier XLS, XLSX ou CSV"
        actions={
          <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/clients')}>
            <ArrowLeft size={13} style={{ marginRight: 4 }} /> Liste des clients
          </Button>
        }
      />

      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ width: '100%', maxWidth: 760 }}>
          <StepIndicator step={step} />

          {step === 1 && stepUpload}
          {step === 2 && stepMapping}
          {step === 3 && stepImporting}
          {step === 4 && stepResult}
        </div>
      </div>
    </>
  )
}
