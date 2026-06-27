'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, ArrowRight } from 'lucide-react'
import { colors, fonts } from '@/lib/tokens'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeliveryStatus {
  id: string
  name: string
  slug: string
  sms_notify: boolean
  is_active: boolean
  sort_order: number
  is_system?: boolean
}

interface TrackingStatus {
  id: string
  name: string
  slug: string
  sms_notify: boolean
  is_active: boolean
  sort_order: number
  is_system: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    'Content-Type': 'application/json',
  }
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
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
      <span style={{
        position: 'absolute',
        top: 2,
        left: checked ? 18 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        display: 'block',
      }} />
    </button>
  )
}

// ─── Shared table styles ──────────────────────────────────────────────────────

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

function iconBtn(danger = false): React.CSSProperties {
  return {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: danger ? colors.red : colors.textMd,
    padding: 4,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
  }
}

function arrowBtn(disabled: boolean): React.CSSProperties {
  return {
    background: 'none',
    border: `1px solid ${colors.border}`,
    borderRadius: 3,
    cursor: disabled ? 'default' : 'pointer',
    color: disabled ? colors.textLt : colors.textMd,
    padding: '2px 3px',
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1,
  }
}

// ─── StatusPanel (livraison + confirmation) ───────────────────────────────────

function StatusPanel({ apiBase }: { apiBase: string }) {
  const [items, setItems] = useState<DeliveryStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<DeliveryStatus | null>(null)
  const [formName, setFormName] = useState('')
  const [formSms, setFormSms] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(apiBase, { headers: authHeader() })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [apiBase])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditItem(null)
    setFormName('')
    setFormSms(false)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(item: DeliveryStatus) {
    setEditItem(item)
    setFormName(item.name)
    setFormSms(item.sms_notify)
    setFormError('')
    setModalOpen(true)
  }

  async function handleSave() {
    const name = formName.trim()
    if (!name) { setFormError('Le nom est requis'); return }
    setSaving(true)
    try {
      const url = editItem ? `${apiBase}/${editItem.id}` : apiBase
      const method = editItem ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: authHeader(),
        body: JSON.stringify({ name, sms_notify: formSms }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Erreur')
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  async function toggleField(item: DeliveryStatus, field: 'sms_notify' | 'is_active') {
    const updated = { ...item, [field]: !item[field] }
    setItems(prev => prev.map(x => x.id === item.id ? updated : x))
    await fetch(`${apiBase}/${item.id}`, {
      method: 'PUT',
      headers: authHeader(),
      body: JSON.stringify({ [field]: updated[field] }),
    })
  }

  async function moveItem(idx: number, dir: 'up' | 'down') {
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= items.length || reordering) return
    setReordering(true)

    const newItems = [...items]
    const soA = newItems[idx].sort_order
    const soB = newItems[targetIdx].sort_order
    const itemA = { ...newItems[idx], sort_order: soB }
    const itemB = { ...newItems[targetIdx], sort_order: soA }
    newItems[idx] = itemB
    newItems[targetIdx] = itemA
    setItems(newItems)

    await Promise.all([
      fetch(`${apiBase}/${itemA.id}`, {
        method: 'PUT', headers: authHeader(),
        body: JSON.stringify({ sort_order: itemA.sort_order }),
      }),
      fetch(`${apiBase}/${itemB.id}`, {
        method: 'PUT', headers: authHeader(),
        body: JSON.stringify({ sort_order: itemB.sort_order }),
      }),
    ])
    setReordering(false)
  }

  async function handleDelete() {
    if (!deleteId) return
    await fetch(`${apiBase}/${deleteId}`, { method: 'DELETE', headers: authHeader() })
    setDeleteId(null)
    load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button onClick={openAdd} size="sm">
          <Plus size={13} />
          Ajouter
        </Button>
      </div>

      <div style={{
        background: '#fff',
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        overflow: 'hidden',
        fontFamily: fonts.sans,
      }}>
        {loading ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: colors.textLt, fontSize: 13 }}>
            Chargement…
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: colors.textLt, fontSize: 13 }}>
            Aucun statut configuré
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ ...thStyle, width: 80 }}>Ordre</th>
                <th style={thStyle}>Nom</th>
                <th style={thStyle}>Slug</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 80 }}>SMS</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 80 }}>Actif</th>
                <th style={{ ...thStyle, textAlign: 'right', width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: idx < items.length - 1 ? `1px solid ${colors.border}` : 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#FAFAFA' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button
                        onClick={() => moveItem(idx, 'up')}
                        disabled={idx === 0 || reordering}
                        style={arrowBtn(idx === 0 || reordering)}
                        title="Monter"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        onClick={() => moveItem(idx, 'down')}
                        disabled={idx === items.length - 1 || reordering}
                        style={arrowBtn(idx === items.length - 1 || reordering)}
                        title="Descendre"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {item.name}
                    {item.is_system && (
                      <span style={{ fontSize: 10, color: colors.textLt, marginLeft: 6, fontStyle: 'italic' }}>
                        système
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <code style={{
                      fontSize: 11,
                      color: colors.textMd,
                      background: '#f5f5f5',
                      padding: '2px 6px',
                      borderRadius: 3,
                    }}>
                      {item.slug}
                    </code>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <Toggle checked={item.sms_notify} onChange={() => toggleField(item, 'sms_notify')} />
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <Toggle checked={item.is_active} onChange={() => toggleField(item, 'is_active')} />
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => openEdit(item)} style={iconBtn()} title="Modifier">
                        <Pencil size={14} />
                      </button>
                      {!item.is_system && (
                        <button onClick={() => setDeleteId(item.id)} style={iconBtn(true)} title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Modifier le statut' : 'Nouveau statut'}
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Nom"
            value={formName}
            onChange={v => { setFormName(v); setFormError('') }}
            placeholder="ex: Reportée"
            required
            error={formError}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle checked={formSms} onChange={setFormSms} />
            <span style={{ fontSize: 13, color: colors.textMd, fontFamily: fonts.sans }}>
              Notifier par SMS
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              {editItem ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Supprimer le statut"
        message="Cette action est irréversible. Confirmer la suppression ?"
        confirmLabel="Supprimer"
        danger
      />
    </div>
  )
}

// ─── Tracking statuses panel (read-only) ─────────────────────────────────────

const FLOW_MAIN = [
  'en_confirmation',
  'en_preparation',
  'en_dispatch',
  'en_livraison',
  'livree',
  'en_retour',
]
const FLOW_TERMINAL = ['retournee', 'encaissee', 'annulee']

function TrackingPanel() {
  const [items, setItems] = useState<TrackingStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/config/tracking-statuses', { headers: authHeader() })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const bySlug = Object.fromEntries(items.map(s => [s.slug, s]))

  function FlowBadge({ slug, color }: { slug: string; color: string }) {
    const s = bySlug[slug]
    return (
      <div style={{
        background: color + '18',
        border: `1px solid ${color}40`,
        borderRadius: 4,
        padding: '4px 10px',
        fontSize: 12,
        color,
        fontWeight: 500,
        fontFamily: fonts.sans,
        whiteSpace: 'nowrap',
      }}>
        {s?.name ?? slug}
      </div>
    )
  }

  const flowColors: Record<string, string> = {
    en_confirmation: colors.donut.enConfirmation,
    en_preparation:  colors.donut.enPreparation,
    en_dispatch:     colors.donut.enDispatch,
    en_livraison:    colors.donut.enLivraison,
    livree:          colors.donut.livrees,
    en_retour:       colors.donut.enRetour,
    retournee:       '#888',
    encaissee:       colors.green,
    annulee:         colors.red,
  }

  return (
    <div style={{ fontFamily: fonts.sans }}>
      {/* Flow diagram */}
      <div style={{
        background: '#fff',
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        padding: '16px 20px',
        marginBottom: 16,
      }}>
        <p style={{ fontSize: 12, color: colors.textLt, margin: '0 0 12px', fontWeight: 500 }}>
          FLUX PRINCIPAL
        </p>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          {FLOW_MAIN.map((slug, i) => (
            <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FlowBadge slug={slug} color={flowColors[slug] ?? colors.textMd} />
              {i < FLOW_MAIN.length - 1 && (
                <ArrowRight size={14} style={{ color: colors.textLt, flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: colors.textLt, margin: '14px 0 8px', fontWeight: 500 }}>
          STATUTS TERMINAUX
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {FLOW_TERMINAL.map(slug => (
            <FlowBadge key={slug} slug={slug} color={flowColors[slug] ?? colors.textMd} />
          ))}
        </div>
      </div>

      {/* Read-only table */}
      <div style={{
        background: '#fff',
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: colors.textLt, fontSize: 13 }}>
            Chargement…
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={thStyle}>Nom</th>
                <th style={thStyle}>Slug</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 80 }}>SMS</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 80 }}>Actif</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: idx < items.length - 1 ? `1px solid ${colors.border}` : 'none' }}
                >
                  <td style={tdStyle}>{item.name}</td>
                  <td style={tdStyle}>
                    <code style={{
                      fontSize: 11,
                      color: colors.textMd,
                      background: '#f5f5f5',
                      padding: '2px 6px',
                      borderRadius: 3,
                    }}>
                      {item.slug}
                    </code>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <Toggle checked={item.sms_notify} disabled />
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <Toggle checked={item.is_active} disabled />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{
        fontSize: 11,
        color: colors.textLt,
        margin: '10px 0 0',
        fontStyle: 'italic',
      }}>
        Les statuts de suivi sont gérés par le système et ne peuvent pas être modifiés.
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Statuts de livraison',    key: 'livraison' },
  { label: 'Statuts de confirmation', key: 'confirmation' },
  { label: 'Statuts de suivi',        key: 'suivi' },
] as const

type TabKey = typeof TABS[number]['key']

export default function StatutsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('livraison')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: fonts.sans }}>
      <PageHeader
        title="Configuration des statuts"
        subtitle="Gérez les statuts de livraison, de confirmation et de suivi des commandes"
      />

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        background: '#fff',
        borderBottom: `1px solid ${colors.border}`,
        padding: '0 16px',
        gap: 0,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
                color: active ? colors.primary : colors.textMd,
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                padding: '10px 16px',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: colors.bg }}>
        {activeTab === 'livraison' && (
          <StatusPanel apiBase="/api/config/delivery-statuses" />
        )}
        {activeTab === 'confirmation' && (
          <StatusPanel apiBase="/api/config/confirmation-statuses" />
        )}
        {activeTab === 'suivi' && (
          <TrackingPanel />
        )}
      </div>
    </div>
  )
}
