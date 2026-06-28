'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
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
    if (!newName.trim()) { setFormError('Le nom est requis.'); return }
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
        setFormError((err as { error?: string }).error ?? 'Erreur lors de la sauvegarde.')
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
        setDeleteError((err as { error?: string }).error ?? 'Erreur lors de la suppression.')
      }
    } finally {
      setDeleting(false)
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────

  const columns: Column<Brand>[] = [
    {
      key: 'name', label: 'Nom',
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
                title="Enregistrer"
                style={{
                  display: 'flex', alignItems: 'center', padding: 4,
                  border: 'none', background: 'none', cursor: 'pointer', color: colors.green,
                }}
              >
                <Check size={15} />
              </button>
              <button
                onClick={cancelEdit}
                title="Annuler"
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
            title="Cliquer pour modifier"
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
      key: 'product_count', label: 'Produits', width: 110,
      render: row => (
        <Badge color={row.product_count > 0 ? 'blue' : 'gray'}>
          {row.product_count} produit{row.product_count !== 1 ? 's' : ''}
        </Badge>
      ),
    },
    {
      key: 'actions', label: 'Actions', width: 165,
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
            <Pencil size={11} /> Modifier
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
            <Trash2 size={11} /> Supprimer
          </button>
        </div>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Marques"
        subtitle="Gestion des marques de produits"
        actions={
          <Button variant="primary" size="sm" onClick={openAdd}>
            + Ajouter une marque
          </Button>
        }
      />

      <div style={{
        flex: 1, overflow: 'auto', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <span style={{ fontSize: 12, color: colors.textMd, fontFamily: fonts.sans }}>
          {loading ? '…' : `${brands.length} marque${brands.length !== 1 ? 's' : ''}`}
        </span>

        <Table<Brand>
          columns={columns}
          data={brands}
          loading={loading}
          emptyText="Aucune marque"
        />
      </div>

      {/* ── Add Modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Ajouter une marque"
        size="sm"
      >
        <Input
          label="Nom"
          value={newName}
          onChange={setNewName}
          placeholder="Ex : Nike"
          required
          error={formError}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Annuler</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleAdd}>Ajouter</Button>
        </div>
      </Modal>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer la marque"
        message={
          deleteError
            ? deleteError
            : (deleteTarget && deleteTarget.product_count > 0
                ? `Attention : « ${deleteTarget.name} » a ${deleteTarget.product_count} produit(s) associé(s). La suppression sera bloquée tant que des produits y sont rattachés.`
                : `Supprimer « ${deleteTarget?.name} » ? Cette action est irréversible.`)
        }
        confirmLabel={deleting ? 'Suppression…' : 'Supprimer'}
        danger
      />
    </>
  )
}
