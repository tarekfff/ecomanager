'use client'
import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { PageHeader, Button, Input } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────────

interface OptionValue { id: string; value: string; sort_order: number }
interface OptionType  { id: string; name: string; sort_order: number; option_values: OptionValue[] }

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ValueChip({
  value,
  onDelete,
}: {
  value: OptionValue
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 20,
        border: `1px solid ${colors.border}`,
        background: hovered ? '#fafafa' : '#fff',
        fontSize: 12.5, fontFamily: fonts.sans, color: colors.textMd,
        cursor: 'default', userSelect: 'none',
      }}
    >
      {value.value}
      <button
        type="button"
        onClick={() => onDelete(value.id)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 14, height: 14, borderRadius: '50%',
          background: hovered ? '#e0e0e0' : 'transparent',
          border: 'none', cursor: 'pointer', color: colors.textLt,
          padding: 0,
        }}
        title="Supprimer cette valeur"
      >
        <X size={10} />
      </button>
    </span>
  )
}

function AddValueInput({
  optionTypeId,
  onAdded,
}: {
  optionTypeId: string
  onAdded: (value: OptionValue) => void
}) {
  const [value,   setValue]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit() {
    const trimmed = value.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      const res  = await fetch(`/api/option-types/${optionTypeId}/values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ value: trimmed }),
      })
      const data = await res.json() as OptionValue & { error?: string }
      if (!res.ok) return
      onAdded(data)
      setValue('')
      inputRef.current?.focus()
    } finally {
      setSaving(false)
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Nouvelle valeur…"
        style={{
          border: `1px solid ${focused ? colors.primary : colors.border}`,
          borderRadius: 4, padding: '5px 9px', fontSize: 12.5,
          fontFamily: fonts.sans, color: colors.text, outline: 'none',
          width: 160, transition: 'border-color 0.15s',
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={saving || !value.trim()}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 10px', borderRadius: 4, fontSize: 12,
          border: `1px solid ${colors.primary}`,
          background: value.trim() ? colors.primary : '#e0e0e0',
          color: '#fff', cursor: value.trim() ? 'pointer' : 'not-allowed',
          fontFamily: fonts.sans,
        }}
      >
        <Plus size={12} /> Ajouter
      </button>
    </div>
  )
}

function OptionTypeCard({
  optionType,
  onUpdated,
  onDeleted,
}: {
  optionType: OptionType
  onUpdated: (updated: OptionType) => void
  onDeleted: (id: string) => void
}) {
  const [editing,    setEditing]    = useState(false)
  const [name,       setName]       = useState(optionType.name)
  const [savingName, setSavingName] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) nameInputRef.current?.focus()
  }, [editing])

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === optionType.name) { setEditing(false); setName(optionType.name); return }
    setSavingName(true)
    try {
      const res  = await fetch(`/api/option-types/${optionType.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) { setName(optionType.name); setEditing(false); return }
      onUpdated({ ...optionType, name: trimmed })
      setEditing(false)
    } finally {
      setSavingName(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Supprimer "${optionType.name}" et toutes ses valeurs ?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/option-types/${optionType.id}`, {
        method: 'DELETE', headers: authHeader(),
      })
      if (res.ok) onDeleted(optionType.id)
    } finally {
      setDeleting(false)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') saveName()
    if (e.key === 'Escape') { setEditing(false); setName(optionType.name) }
  }

  function handleDeleteValue(valueId: string) {
    fetch(`/api/option-types/${optionType.id}/values?value_id=${valueId}`, {
      method: 'DELETE', headers: authHeader(),
    }).then(res => {
      if (res.ok) {
        onUpdated({ ...optionType, option_values: optionType.option_values.filter(v => v.id !== valueId) })
      }
    })
  }

  function handleValueAdded(newVal: OptionValue) {
    onUpdated({ ...optionType, option_values: [...optionType.option_values, newVal] })
  }

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${colors.border}`,
      borderRadius: 6,
      padding: '16px 18px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
            <input
              ref={nameInputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={onKeyDown}
              style={{
                border: `1px solid ${colors.primary}`, borderRadius: 4,
                padding: '5px 9px', fontSize: 14, fontWeight: 600,
                fontFamily: fonts.sans, color: colors.text,
                outline: 'none', flex: 1,
              }}
            />
            <button
              type="button" onClick={saveName} disabled={savingName}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary }}
              title="Enregistrer"
            >
              <Check size={15} />
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setName(optionType.name) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textLt }}
              title="Annuler"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: colors.text, fontFamily: fonts.sans }}>
              {optionType.name}
            </span>
            <button
              type="button" onClick={() => setEditing(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textLt, padding: 2 }}
              title="Renommer"
            >
              <Pencil size={13} />
            </button>
          </div>
        )}

        <button
          type="button" onClick={handleDelete} disabled={deleting}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 4,
            border: `1px solid #fca5a5`, background: '#fff5f5',
            color: '#dc3545', fontSize: 12, fontFamily: fonts.sans,
            cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
          }}
        >
          <Trash2 size={12} /> Supprimer
        </button>
      </div>

      {/* Values */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, minHeight: 28 }}>
        {optionType.option_values.length === 0 ? (
          <span style={{ fontSize: 12.5, color: colors.textLt, fontFamily: fonts.sans, alignSelf: 'center' }}>
            Aucune valeur pour l&apos;instant.
          </span>
        ) : (
          optionType.option_values.map(v => (
            <ValueChip key={v.id} value={v} onDelete={handleDeleteValue} />
          ))
        )}
      </div>

      {/* Add value input */}
      <AddValueInput optionTypeId={optionType.id} onAdded={handleValueAdded} />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OptionsPage() {
  const [optionTypes, setOptionTypes] = useState<OptionType[]>([])
  const [loading,     setLoading]     = useState(true)
  const [newTypeName, setNewTypeName] = useState('')
  const [creating,    setCreating]    = useState(false)
  const [createErr,   setCreateErr]   = useState('')

  useEffect(() => {
    fetch('/api/option-types', { headers: authHeader() })
      .then(r => r.json())
      .then((d: OptionType[]) => { if (Array.isArray(d)) setOptionTypes(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate() {
    const trimmed = newTypeName.trim()
    if (!trimmed) { setCreateErr('Le nom est requis'); return }
    setCreating(true); setCreateErr('')
    try {
      const res  = await fetch('/api/option-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json() as OptionType & { error?: string }
      if (!res.ok) { setCreateErr(data.error ?? 'Erreur'); return }
      setOptionTypes(prev => [...prev, data])
      setNewTypeName('')
    } finally {
      setCreating(false)
    }
  }

  function handleUpdated(updated: OptionType) {
    setOptionTypes(prev => prev.map(ot => ot.id === updated.id ? updated : ot))
  }

  function handleDeleted(id: string) {
    setOptionTypes(prev => prev.filter(ot => ot.id !== id))
  }

  return (
    <>
      <PageHeader
        title="Options & attributs"
        subtitle="Gérez les types d'attributs (Couleur, Taille…) et leurs valeurs."
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 20px 40px' }}>

        {/* Create new type */}
        <div style={{
          background: '#fff',
          border: `1px solid ${colors.border}`,
          borderRadius: 6,
          padding: '16px 18px',
          marginBottom: 20,
        }}>
          <p style={{
            margin: '0 0 12px', fontSize: 12, fontWeight: 700,
            color: colors.textLt, textTransform: 'uppercase',
            letterSpacing: '0.5px', fontFamily: fonts.sans,
          }}>
            Nouvel attribut
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Nom de l'attribut"
                value={newTypeName}
                onChange={v => { setNewTypeName(v); setCreateErr('') }}
                placeholder="Ex : Couleur, Taille, Matière…"
                error={createErr}
              />
            </div>
            <Button variant="primary" size="sm" loading={creating} onClick={handleCreate}>
              <Plus size={13} style={{ marginRight: 4 }} />
              Créer
            </Button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <p style={{ fontSize: 13, color: colors.textLt, fontFamily: fonts.sans }}>Chargement…</p>
        ) : optionTypes.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: colors.textLt, fontFamily: fonts.sans,
          }}>
            <p style={{ fontSize: 14, marginBottom: 6 }}>Aucun attribut défini.</p>
            <p style={{ fontSize: 12.5 }}>
              Créez vos premiers types d&apos;attributs ci-dessus pour générer des variantes de produit.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {optionTypes.map(ot => (
              <OptionTypeCard
                key={ot.id}
                optionType={ot}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
