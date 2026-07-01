'use client'
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import {
  PageHeader, Table, Modal, Button, Input, ConfirmDialog,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────

interface Supplier {
  id:      string
  name:    string
  phone:   string | null
  email:   string | null
  address: string | null
}

interface SupplierForm {
  name:    string
  phone:   string
  email:   string
  address: string
}

const EMPTY_FORM: SupplierForm = { name: '', phone: '', email: '', address: '' }

// ── Helpers ────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function FournisseursPage() {
  const { t } = useTranslation('suppliers')
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading,   setLoading]   = useState(false)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem,  setEditItem]  = useState<Supplier | null>(null)
  const [form,      setForm]      = useState<SupplierForm>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving,    setSaving]    = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState('')

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchSuppliers = useCallback(() => {
    setLoading(true)
    fetch('/api/suppliers', { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSuppliers(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openAdd() {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditItem(s)
    setForm({
      name:    s.name,
      phone:   s.phone   ?? '',
      email:   s.email   ?? '',
      address: s.address ?? '',
    })
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() { setModalOpen(false); setFormError('') }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.name.trim()) { setFormError(t('nameRequired')); return }
    setSaving(true)
    setFormError('')
    try {
      const body = {
        name:    form.name.trim(),
        phone:   form.phone.trim()   || null,
        email:   form.email.trim()   || null,
        address: form.address.trim() || null,
      }
      const url    = editItem ? `/api/suppliers/${editItem.id}` : '/api/suppliers'
      const method = editItem ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setFormError((err as { error?: string }).error ?? t('saveError'))
        return
      }
      setModalOpen(false)
      fetchSuppliers()
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  function openDelete(s: Supplier) {
    setDeleteError('')
    setDeleteTarget(s)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/suppliers/${deleteTarget.id}`, {
        method: 'DELETE', headers: authHeader(),
      })
      if (res.ok) {
        setDeleteTarget(null)
        fetchSuppliers()
      } else {
        const err = await res.json().catch(() => ({}))
        setDeleteError((err as { error?: string }).error ?? t('deleteError'))
      }
    } finally {
      setDeleting(false)
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: Column<Supplier>[] = [
    {
      key: 'name', label: t('common:fields.name'),
      render: row => <span style={{ fontWeight: 500, color: colors.text }}>{row.name}</span>,
    },
    {
      key: 'phone', label: t('common:fields.phone'), width: 140,
      render: row => (
        <span style={{ color: row.phone ? colors.textMd : colors.textLt, fontSize: 12 }}>
          {row.phone ?? '—'}
        </span>
      ),
    },
    {
      key: 'email', label: t('common:fields.email'), width: 200,
      render: row => (
        <span style={{ color: row.email ? colors.textMd : colors.textLt, fontSize: 12 }}>
          {row.email ?? '—'}
        </span>
      ),
    },
    {
      key: 'address', label: t('common:fields.address'),
      render: row => (
        <span style={{ color: row.address ? colors.textMd : colors.textLt, fontSize: 12 }}>
          {row.address ?? '—'}
        </span>
      ),
    },
    {
      key: 'actions', label: t('common:fields.actions'), width: 165,
      render: row => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => openEdit(row)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11.5, padding: '3px 8px', borderRadius: 3,
              border: `1px solid ${colors.border}`,
              background: '#fff', color: colors.textMd,
              cursor: 'pointer', fontFamily: fonts.sans,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
          >
            <Pencil size={11} /> {t('common:actions.edit')}
          </button>
          <button
            onClick={() => openDelete(row)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11.5, padding: '3px 8px', borderRadius: 3,
              border: '1px solid #f5c6cb', background: '#fff8f8',
              color: colors.red, cursor: 'pointer', fontFamily: fonts.sans,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fde8ea')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff8f8')}
          >
            <Trash2 size={11} /> {t('common:actions.delete')}
          </button>
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
          <Button variant="primary" size="sm" onClick={openAdd}>
            {t('addBtn')}
          </Button>
        }
      />

      <div style={{
        flex: 1, overflow: 'auto', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <span style={{ fontSize: 12, color: colors.textMd, fontFamily: fonts.sans }}>
          {loading ? '…' : t('count', { count: suppliers.length })}
        </span>

        <Table<Supplier>
          columns={columns}
          data={suppliers}
          loading={loading}
          emptyText={t('empty')}
        />
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editItem ? t('editModalTitle') : t('addModalTitle')}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label={t('common:fields.name')}
            value={form.name}
            onChange={v => setForm(f => ({ ...f, name: v }))}
            placeholder={t('namePlaceholder')}
            required
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              label={t('common:fields.phone')}
              value={form.phone}
              onChange={v => setForm(f => ({ ...f, phone: v }))}
              placeholder={t('phonePlaceholder')}
            />
            <Input
              label={t('common:fields.email')}
              type="email"
              value={form.email}
              onChange={v => setForm(f => ({ ...f, email: v }))}
              placeholder={t('emailPlaceholder')}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <label style={{
              fontSize: 12.5, color: colors.textMd, marginBottom: 4, fontWeight: 500,
              fontFamily: fonts.sans,
            }}>
              {t('common:fields.address')}
            </label>
            <textarea
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder={t('addressPlaceholder')}
              rows={3}
              style={{
                width: '100%', border: `1px solid ${colors.border}`, borderRadius: 4,
                padding: '7px 10px', fontSize: 13, color: colors.text,
                fontFamily: fonts.sans, outline: 'none', boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        {formError && (
          <p style={{ fontSize: 12, color: colors.red, marginTop: 10, fontFamily: fonts.sans }}>
            {formError}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="secondary" size="sm" onClick={closeModal}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            {editItem ? t('common:actions.save') : t('common:actions.add')}
          </Button>
        </div>
      </Modal>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('deleteTitle')}
        message={
          deleteError
            ? deleteError
            : t('deleteConfirm', { name: deleteTarget?.name ?? '' })
        }
        confirmLabel={deleting ? t('deleting') : t('common:actions.delete')}
        danger
      />
    </>
  )
}
