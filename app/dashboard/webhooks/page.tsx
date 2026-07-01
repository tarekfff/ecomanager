'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, ScrollText, Copy, Check, RefreshCw, Truck } from 'lucide-react'
import {
  PageHeader, Table, Modal, Button, Input, Badge, ConfirmDialog,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Webhook events (19 total) — grouped for the select ──────────────────────

// labels are translated inside the component using t('eventGroups.*')
const EVENT_GROUPS_KEYS: { key: 'lifecycle' | 'statusChanges' | 'modifications'; events: string[] }[] = [
  {
    key: 'lifecycle',
    events: [
      'OrderCreated', 'OrderConfirmed', 'OrderDispatched', 'OrderShipped',
      'OrderDelivered', 'OrderFailed', 'OrderPaid', 'OrderReturned',
      'OrderCanceled', 'OrderDeleted', 'OrderRestored',
    ],
  },
  {
    key: 'statusChanges',
    events: [
      'OrderStatusChanged', 'OrderConfirmationStatusChanged',
      'OrderShippingStatusChanged', 'OrderTrackingStatusChanged',
    ],
  },
  {
    key: 'modifications',
    events: [
      'OrderAddressChanged', 'OrderItemsChanged',
      'OrderConfirmerChanged', 'OrderCarrierChanged',
    ],
  },
]

// ── Types ──────────────────────────────────────────────────────────────────

interface Webhook {
  id:             string
  name:           string
  event:          string
  url:            string
  secret:         string
  boutique_ids:   string[]
  boutique_names: string[]
  is_active:      boolean
  created_at:     string
}

interface Boutique {
  id:   string
  name: string
}

interface FormState {
  name:         string
  event:        string
  url:          string
  secret:       string
  boutique_ids: string[]
  is_active:    boolean
}

// ── Helpers ────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function uuidV4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const EMPTY_FORM: FormState = {
  name: '', event: '', url: '', secret: '', boutique_ids: [], is_active: true,
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const { t } = useTranslation('webhooks')
  const [webhooks,  setWebhooks]  = useState<Webhook[]>([])
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [loading,   setLoading]   = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving,    setSaving]    = useState(false)
  const [copied,    setCopied]    = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState('')

  // NOEST setup state
  const [noestLoading, setNoestLoading] = useState(false)
  const [noestMsg,     setNoestMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────

  const fetchWebhooks = useCallback(() => {
    setLoading(true)
    fetch('/api/webhooks', { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setWebhooks(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchWebhooks()
    fetch('/api/boutiques', { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setBoutiques(d) })
      .catch(() => {})
  }, [fetchWebhooks])

  // ── Add / Edit ───────────────────────────────────────────────────────────

  function openAdd() {
    setEditId(null)
    setForm({ ...EMPTY_FORM, secret: uuidV4() })
    setFormError('')
    setCopied(false)
    setModalOpen(true)
  }

  function openEdit(w: Webhook) {
    setEditId(w.id)
    setForm({
      name: w.name, event: w.event, url: w.url, secret: w.secret,
      boutique_ids: w.boutique_ids ?? [], is_active: w.is_active,
    })
    setFormError('')
    setCopied(false)
    setModalOpen(true)
  }

  function toggleBoutique(id: string) {
    setForm(f => ({
      ...f,
      boutique_ids: f.boutique_ids.includes(id)
        ? f.boutique_ids.filter(b => b !== id)
        : [...f.boutique_ids, id],
    }))
  }

  function copySecret() {
    navigator.clipboard?.writeText(form.secret).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  async function handleSave() {
    if (!form.name.trim())  { setFormError(t('errors.nameRequired')); return }
    if (!form.event)        { setFormError(t('errors.eventRequired')); return }
    if (!form.url.trim())   { setFormError(t('errors.urlRequired')); return }

    setSaving(true)
    setFormError('')
    try {
      const res = await fetch(
        editId ? `/api/webhooks/${editId}` : '/api/webhooks',
        {
          method: editId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({
            name: form.name.trim(),
            event: form.event,
            url: form.url.trim(),
            secret: form.secret.trim(),
            boutique_ids: form.boutique_ids,
            is_active: form.is_active,
          }),
        },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setFormError((err as { error?: string }).error ?? t('errors.saveFailed'))
        return
      }
      setModalOpen(false)
      fetchWebhooks()
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle active (inline) ──────────────────────────────────────────────

  async function toggleActive(w: Webhook) {
    const next = !w.is_active
    setWebhooks(prev => prev.map(x => x.id === w.id ? { ...x, is_active: next } : x))
    const res = await fetch(`/api/webhooks/${w.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ is_active: next }),
    })
    if (!res.ok) {
      // Revert on failure
      setWebhooks(prev => prev.map(x => x.id === w.id ? { ...x, is_active: w.is_active } : x))
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  function openDelete(w: Webhook) {
    setDeleteError('')
    setDeleteTarget(w)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/webhooks/${deleteTarget.id}`, {
        method: 'DELETE', headers: authHeader(),
      })
      if (res.ok) {
        setDeleteTarget(null)
        fetchWebhooks()
      } else {
        const err = await res.json().catch(() => ({}))
        setDeleteError((err as { error?: string }).error ?? t('errors.deleteFailed'))
      }
    } finally {
      setDeleting(false)
    }
  }

  // ── NOEST livraison setup ───────────────────────────────────────────────────

  async function setupNoest() {
    setNoestLoading(true)
    setNoestMsg(null)
    try {
      const res = await fetch('/api/webhooks/noest/setup', {
        method: 'POST', headers: authHeader(),
      })
      const d = await res.json().catch(() => ({})) as {
        error?: string; created?: boolean
        ping?: { ok: boolean; status: number; wilayas?: number; body?: string }
      }
      if (!res.ok) {
        setNoestMsg({ ok: false, text: d.error ?? t('noest.error') })
        return
      }
      const pingTxt = d.ping?.ok
        ? t('noest.pingOk', { wilayas: d.ping.wilayas ?? '?' })
        : t('noest.pingFailed', { status: d.ping?.status ?? 0 })
      setNoestMsg({
        ok: !!d.ping?.ok,
        text: `${d.created ? t('noest.created') : t('noest.alreadyConfigured')} ${pingTxt}`,
      })
      fetchWebhooks()
    } finally {
      setNoestLoading(false)
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: Column<Webhook>[] = [
    {
      key: 'name', label: t('table.name'),
      render: row => <span style={{ fontWeight: 500, color: colors.text }}>{row.name}</span>,
    },
    {
      key: 'event', label: t('table.event'), width: 220,
      render: row => <Badge color="purple">{row.event}</Badge>,
    },
    {
      key: 'url', label: t('table.url'),
      render: row => (
        <span style={{
          color: colors.textMd, fontSize: 12, maxWidth: 260,
          display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', verticalAlign: 'bottom',
        }} title={row.url}>
          {row.url}
        </span>
      ),
    },
    {
      key: 'boutiques', label: t('table.boutiques'), width: 200,
      render: row => {
        if (!row.boutique_names || row.boutique_names.length === 0) {
          return <span style={{ color: colors.textLt, fontSize: 12 }}>{t('table.allBoutiques')}</span>
        }
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {row.boutique_names.map(n => <Badge key={n} color="gray">{n}</Badge>)}
          </div>
        )
      },
    },
    {
      key: 'is_active', label: t('table.active'), width: 80,
      render: row => <Toggle on={row.is_active} onClick={() => toggleActive(row)} />,
    },
    {
      key: 'actions', label: t('table.actions'), width: 240,
      render: row => (
        <div style={{ display: 'flex', gap: 6 }}>
          <ActionBtn icon={<Pencil size={11} />} label={t('actions.edit')} onClick={() => openEdit(row)} />
          <Link href={`/dashboard/webhooks/${row.id}/logs`} style={{ textDecoration: 'none' }}>
            <ActionBtn icon={<ScrollText size={11} />} label={t('actions.logs')} />
          </Link>
          <ActionBtn
            icon={<Trash2 size={11} />} label={t('actions.delete')} danger
            onClick={() => openDelete(row)}
          />
        </div>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Button variant="secondary" size="sm" loading={noestLoading} onClick={setupNoest}>
              <Truck size={13} /> {t('setupNoest')}
            </Button>
            <Button variant="primary" size="sm" onClick={openAdd}>
              {t('addWebhook')}
            </Button>
          </>
        }
      />

      <div style={{
        flex: 1, overflow: 'auto', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {noestMsg && (
          <div style={{
            fontSize: 12.5, fontFamily: fonts.sans, padding: '8px 12px', borderRadius: 6,
            border: `1px solid ${noestMsg.ok ? '#b7e0c0' : '#f5c6cb'}`,
            background: noestMsg.ok ? '#eafaf0' : '#fff8f8',
            color: noestMsg.ok ? '#1B5E20' : colors.red,
          }}>
            {noestMsg.text}
          </div>
        )}

        <span style={{ fontSize: 12, color: colors.textMd, fontFamily: fonts.sans }}>
          {loading ? '…' : t('count', { count: webhooks.length })}
        </span>

        <Table<Webhook>
          columns={columns}
          data={webhooks}
          loading={loading}
          emptyText={t('empty')}
        />
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? t('editTitle') : t('addTitle')}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label={t('form.name')} value={form.name}
            onChange={v => setForm(f => ({ ...f, name: v }))}
            placeholder={t('form.namePh')} required
          />

          {/* Grouped event select */}
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: fonts.sans }}>
            <label style={{ fontSize: 12.5, color: colors.textMd, marginBottom: 4, fontWeight: 500 }}>
              {t('form.event')}<span style={{ color: colors.primary, marginLeft: 2 }}>*</span>
            </label>
            <select
              value={form.event}
              onChange={e => setForm(f => ({ ...f, event: e.target.value }))}
              style={{
                width: '100%', border: `1px solid ${colors.border}`, borderRadius: 4,
                padding: '7px 10px', fontSize: 13,
                color: form.event ? colors.text : colors.textLt,
                fontFamily: fonts.sans, outline: 'none', background: '#fff',
                cursor: 'pointer', boxSizing: 'border-box',
              }}
            >
              <option value="" disabled>{t('form.eventPh')}</option>
              {EVENT_GROUPS_KEYS.map(group => (
                <optgroup key={group.key} label={t('eventGroups.' + group.key)}>
                  {group.events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <Input
            label={t('form.url')} value={form.url}
            onChange={v => setForm(f => ({ ...f, url: v }))}
            placeholder={t('form.urlPh')} required
          />

          {/* Secret with copy + regenerate */}
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: fonts.sans }}>
            <label style={{ fontSize: 12.5, color: colors.textMd, marginBottom: 4, fontWeight: 500 }}>
              {t('form.secret')}
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                value={form.secret} readOnly
                style={{
                  flex: 1, border: `1px solid ${colors.border}`, borderRadius: 4,
                  padding: '7px 10px', fontSize: 12.5, color: colors.textMd,
                  fontFamily: 'monospace', outline: 'none', background: '#f9f9f9',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button" onClick={copySecret} title="Copier"
                style={iconBtnStyle(copied ? colors.green : colors.textMd)}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, secret: uuidV4() }))}
                title="Régénérer"
                style={iconBtnStyle(colors.textMd)}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Boutiques multi-select */}
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: fonts.sans }}>
            <label style={{ fontSize: 12.5, color: colors.textMd, marginBottom: 6, fontWeight: 500 }}>
              {t('form.boutiques')} <span style={{ color: colors.textLt, fontWeight: 400 }}>{t('form.boutiqueHint')}</span>
            </label>
            {boutiques.length === 0 ? (
              <span style={{ fontSize: 12, color: colors.textLt }}>{t('form.noBoutiques')}</span>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                maxHeight: 160, overflowY: 'auto',
                border: `1px solid ${colors.border}`, borderRadius: 4, padding: 10,
              }}>
                {boutiques.map(b => (
                  <label key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 13, color: colors.text, cursor: 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={form.boutique_ids.includes(b.id)}
                      onChange={() => toggleBoutique(b.id)}
                      style={{ accentColor: colors.primary, cursor: 'pointer' }}
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Active toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <Toggle on={form.is_active} onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} />
            <span style={{ fontSize: 13, color: colors.text, fontFamily: fonts.sans }}>
              {form.is_active ? t('active') : t('inactive')}
            </span>
          </label>

          {formError && (
            <span style={{ fontSize: 12, color: colors.red, fontFamily: fonts.sans }}>{formError}</span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>{t('cancel')}</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            {editId ? t('save') : t('add')}
          </Button>
        </div>
      </Modal>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('delete.title')}
        message={
          deleteError
            ? deleteError
            : t('delete.message', { name: deleteTarget?.name })
        }
        confirmLabel={deleting ? t('delete.deleting') : t('delete.confirm')}
        danger
      />
    </>
  )
}

// ── Small components ─────────────────────────────────────────────────────────

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: on ? colors.primary : colors.border,
        position: 'relative', transition: 'background 0.15s', flexShrink: 0, padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function ActionBtn({
  icon, label, onClick, danger,
}: {
  icon: React.ReactNode; label: string; onClick?: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 11.5, padding: '3px 8px', borderRadius: 3,
        border: `1px solid ${danger ? '#f5c6cb' : colors.border}`,
        background: danger ? '#fff8f8' : '#fff',
        color: danger ? colors.red : colors.textMd,
        cursor: 'pointer', fontFamily: fonts.sans,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? '#fde8ea' : '#f5f5f5')}
      onMouseLeave={e => (e.currentTarget.style.background = danger ? '#fff8f8' : '#fff')}
    >
      {icon} {label}
    </button>
  )
}

function iconBtnStyle(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, border: `1px solid ${colors.border}`,
    borderRadius: 4, background: '#fff', cursor: 'pointer', color, flexShrink: 0,
  }
}
