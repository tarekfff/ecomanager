'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import {
  PageHeader, Table, Modal, Button, Input, Badge, ConfirmDialog,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────

interface Brand {
  id:            string
  name:          string
  product_count: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function MarquesPage() {
  const { t } = useTranslation('brands')
  const [brands,  setBrands]  = useState<Brand[]>([])
  const [loading, setLoading] = useState(false)

  // Add modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [newName,   setNewName]   = useState('')
  const [formError, setFormError] = useState('')
  const [saving,    setSaving]    = useState(false)

  // Inline edit state
  const [editId,      setEditId]      = useState<string | null>(null)
  const [editValue,   setEditValue]   = useState('')
  const [savingInline, setSavingInline] = useState(false)
  const editInputRef  = useRef<HTMLInputElement | null>(null)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Brand | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [deleteError,  setDeleteError]  = useState('')

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchBrands = useCallback(() => {
    setLoading(true)
    fetch('/api/brands', { headers: authHeader() })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setBrands(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchBrands() }, [fetchBrands])

  // ── Add ──────────────────────────────────────────────────────────────────

  function openAdd() {
    setNewName('')
    setFormError('')
    setModalOpen(true)
  }

  async function handleAdd() {
    if (!newName.trim()) { setFormError(t('nameRequired')); return }
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setFormError((err as { error?: string }).error ?? t('saveError'))
        return
      }
      setModalOpen(false)
      fetchBrands()
    } finally {
      setSaving(false)
    }
  }

  // ── Inline edit ────────────────────────────────────────────────────────────

  function startEdit(brand: Brand) {
    setEditId(brand.id)
    setEditValue(brand.name)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  function cancelEdit() {
    setEditId(null)
    setEditValue('')
  }

  async function saveEdit(brand: Brand) {
    const name = editValue.trim()
    if (!name || name === brand.name) { cancelEdit(); return }
    setSavingInline(true)
    try {
      const res = await fetch(`/api/brands/${brand.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setBrands(prev => prev.map(b => b.id === brand.id ? { ...b, name } : b))
        cancelEdit()
      }
    } finally {
      setSavingInline(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  function openDelete(brand: Brand) {
    setDeleteError('')
    setDeleteTarget(brand)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/brands/${deleteTarget.id}`, {
        method: 'DELETE', headers: authHeader(),
      })
      if (res.ok) {
        setDeleteTarget(null)
        fetchBrands()
      } else {
        const err = await res.json().catch(() => ({}))
        setDeleteError((err as { error?: string }).error ?? t('deleteError'))
      }
    } finally {
      setDeleting(false)
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: Column<Brand>[] = [
    {
      key: 'name', label: t('cols.name'),
      render: row => {
        if (editId === row.id) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                ref={editInputRef}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEdit(row)
                  if (e.key === 'Escape') cancelEdit()
                }}
                disabled={savingInline}
                style={{
                  border: `1px solid ${colors.primary}`,
                  borderRadius: 4, padding: '4px 8px', fontSize: 12.5,
                  color: colors.text, fontFamily: fonts.sans, outline: 'none',
                  minWidth: 200,
                }}
              />
              <button
                onClick={() => saveEdit(row)}
                title={t('common:actions.save')}
                style={{
                  display: 'flex', alignItems: 'center', padding: 4,
                  border: 'none', background: 'none', cursor: 'pointer', color: colors.green,
                }}
              >
                <Check size={15} />
              </button>
              <button
                onClick={cancelEdit}
                title={t('common:actions.cancel')}
                style={{
                  display: 'flex', alignItems: 'center', padding: 4,
                  border: 'none', background: 'none', cursor: 'pointer', color: colors.textLt,
                }}
              >
                <X size={15} />
              </button>
            </div>
          )
        }
        return (
          <span
            onClick={() => startEdit(row)}
            title={t('editTooltip')}
            style={{
              fontWeight: 500, color: colors.text, cursor: 'pointer',
              borderBottom: `1px dashed ${colors.border}`, paddingBottom: 1,
            }}
          >
            {row.name}
          </span>
        )
      },
    },
    {
      key: 'product_count', label: t('cols.products'), width: 110,
      render: row => (
        <Badge color={row.product_count > 0 ? 'blue' : 'gray'}>
          {t('productsBadge', { count: row.product_count })}
        </Badge>
      ),
    },
    {
      key: 'actions', label: t('cols.actions'), width: 165,
      render: row => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => startEdit(row)}
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
          {loading ? '…' : t('count', { count: brands.length })}
        </span>

        <Table<Brand>
          columns={columns}
          data={brands}
          loading={loading}
          emptyText={t('empty')}
        />
      </div>

      {/* ── Add Modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('addModalTitle')}
        size="sm"
      >
        <Input
          label={t('nameLabel')}
          value={newName}
          onChange={setNewName}
          placeholder={t('namePlaceholder')}
          required
          error={formError}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>{t('common:actions.cancel')}</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleAdd}>{t('common:actions.add')}</Button>
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
            : (deleteTarget && deleteTarget.product_count > 0
                ? t('deleteWarn', { name: deleteTarget.name, count: deleteTarget.product_count })
                : t('deleteConfirm', { name: deleteTarget?.name ?? '' }))
        }
        confirmLabel={deleting ? t('deleting') : t('common:actions.delete')}
        danger
      />
    </>
  )
}
