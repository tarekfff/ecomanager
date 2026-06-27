'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Globe, AlertTriangle } from 'lucide-react'
import { colors, fonts } from '@/lib/tokens'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Boutique {
  id: string
  name: string
  prefix: string
  domain: string | null
  is_active: boolean
  created_at: string
  users_count: number
  orders_count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    'Content-Type': 'application/json',
  }
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange?: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: 'none',
        background: checked ? colors.primary : colors.border,
        position: 'relative',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          display: 'block',
        }}
      />
    </button>
  )
}

// ─── Table styles ─────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: colors.textMd,
  padding: '8px 12px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '8px 12px',
  color: colors.text,
}

function iconBtn(): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.textMd,
    padding: 4,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BoutiquesPage() {
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Boutique | null>(null)
  const [saving, setSaving] = useState(false)

  // Form fields
  const [formName, setFormName] = useState('')
  const [formPrefix, setFormPrefix] = useState('')
  const [formDomain, setFormDomain] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [prefixChanged, setPrefixChanged] = useState(false)
  const [apiError, setApiError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/config/boutiques', { headers: authHeader() })
      .then(r => r.json())
      .then(d => setBoutiques(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditItem(null)
    setFormName('')
    setFormPrefix('')
    setFormDomain('')
    setFormActive(true)
    setErrors({})
    setApiError('')
    setPrefixChanged(false)
    setModalOpen(true)
  }

  function openEdit(b: Boutique) {
    setEditItem(b)
    setFormName(b.name)
    setFormPrefix(b.prefix)
    setFormDomain(b.domain ?? '')
    setFormActive(b.is_active)
    setErrors({})
    setApiError('')
    setPrefixChanged(false)
    setModalOpen(true)
  }

  function handlePrefixChange(val: string) {
    const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
    setFormPrefix(upper)
    setErrors(prev => ({ ...prev, prefix: '' }))
    if (editItem && upper !== editItem.prefix) setPrefixChanged(true)
    if (editItem && upper === editItem.prefix) setPrefixChanged(false)
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!formName.trim()) next.name = 'Le nom est requis'
    if (!formPrefix.trim()) next.prefix = 'Le préfixe est requis'
    else if (formPrefix.length < 2 || formPrefix.length > 6)
      next.prefix = 'Entre 2 et 6 caractères'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    setApiError('')
    try {
      const url = editItem ? `/api/config/boutiques/${editItem.id}` : '/api/config/boutiques'
      const method = editItem ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: authHeader(),
        body: JSON.stringify({
          name: formName.trim(),
          prefix: formPrefix,
          domain: formDomain.trim() || null,
          is_active: formActive,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Erreur')
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(b: Boutique) {
    const optimistic = { ...b, is_active: !b.is_active }
    setBoutiques(prev => prev.map(x => x.id === b.id ? optimistic : x))
    const res = await fetch(`/api/config/boutiques/${b.id}`, {
      method: 'PUT',
      headers: authHeader(),
      body: JSON.stringify({ is_active: !b.is_active }),
    })
    if (!res.ok) {
      // revert on failure
      setBoutiques(prev => prev.map(x => x.id === b.id ? b : x))
    }
  }

  const exampleRef = formPrefix
    ? `${formPrefix}0001`
    : 'CMD0001'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: fonts.sans }}>
      <PageHeader
        title="Boutiques"
        subtitle="Gérez vos boutiques et leurs paramètres"
        actions={
          <Button onClick={openAdd} size="sm">
            <Plus size={13} />
            Nouvelle boutique
          </Button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: colors.bg }}>
        <div style={{
          background: '#fff',
          border: `1px solid ${colors.border}`,
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: colors.textLt, fontSize: 13 }}>
              Chargement…
            </div>
          ) : boutiques.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: colors.textLt, fontSize: 13 }}>
              Aucune boutique configurée
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={thStyle}>Nom</th>
                  <th style={thStyle}>Préfixe</th>
                  <th style={thStyle}>Domaine</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: 90 }}>Utilisateurs</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: 90 }}>Commandes</th>
                  <th style={{ ...thStyle, textAlign: 'center', width: 80 }}>Statut</th>
                  <th style={{ ...thStyle, textAlign: 'right', width: 70 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {boutiques.map((b, idx) => (
                  <tr
                    key={b.id}
                    style={{ borderBottom: idx < boutiques.length - 1 ? `1px solid ${colors.border}` : 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#FAFAFA' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                  >
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{b.name}</td>
                    <td style={tdStyle}>
                      <code style={{
                        fontSize: 12,
                        background: colors.primaryLt,
                        color: colors.primary,
                        padding: '2px 7px',
                        borderRadius: 3,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                      }}>
                        {b.prefix}
                      </code>
                    </td>
                    <td style={{ ...tdStyle, color: b.domain ? colors.text : colors.textLt }}>
                      {b.domain ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Globe size={13} style={{ color: colors.textLt, flexShrink: 0 }} />
                          {b.domain}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {b.users_count}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {b.orders_count.toLocaleString('fr-DZ')}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Toggle checked={b.is_active} onChange={() => toggleActive(b)} />
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <button onClick={() => openEdit(b)} style={iconBtn()} title="Modifier">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Modifier la boutique' : 'Nouvelle boutique'}
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Nom"
            value={formName}
            onChange={v => { setFormName(v); setErrors(prev => ({ ...prev, name: '' })) }}
            placeholder="ex: Boutique Alger"
            required
            error={errors.name}
          />

          <div>
            <Input
              label="Préfixe"
              value={formPrefix}
              onChange={handlePrefixChange}
              placeholder="ex: CMD"
              required
              error={errors.prefix}
            />
            <p style={{ fontSize: 11.5, color: colors.textLt, margin: '4px 0 0', fontFamily: fonts.sans }}>
              2–6 caractères, majuscules uniquement. Exemple de référence :{' '}
              <span style={{ color: colors.primary, fontWeight: 600 }}>{exampleRef}</span>
            </p>
            {prefixChanged && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                marginTop: 6,
                padding: '7px 10px',
                background: '#FFF8E1',
                border: '1px solid #FFE082',
                borderRadius: 4,
              }}>
                <AlertTriangle size={14} style={{ color: '#F59800', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12, color: '#7A5C00', fontFamily: fonts.sans, lineHeight: 1.4 }}>
                  Attention : le changement de préfixe n&apos;affecte pas les références de commandes déjà créées.
                </span>
              </div>
            )}
          </div>

          <Input
            label="Domaine (optionnel)"
            value={formDomain}
            onChange={v => setFormDomain(v)}
            placeholder="ex: boutique.dz"
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle checked={formActive} onChange={setFormActive} />
            <span style={{ fontSize: 13, color: colors.textMd, fontFamily: fonts.sans }}>
              Boutique active
            </span>
          </div>

          {apiError && (
            <p style={{ fontSize: 12, color: colors.red, margin: 0, fontFamily: fonts.sans }}>
              {apiError}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              {editItem ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
