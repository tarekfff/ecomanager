'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import {
  PageHeader, Table, Pagination, Modal, Button,
  Input, Badge, SearchInput, ConfirmDialog,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────

interface Carrier {
  id:            string
  name:          string
  phone:         string | null
  platform:      string | null
  wilaya_ids:    number[]
  manages_stock: boolean
  is_active:     boolean
  boutique_ids:  string[]
}

interface Boutique { id: string; name: string; prefix: string }
interface Wilaya   { id: number; name: string }

interface CarrierForm {
  name:          string
  phone:         string
  platform:      string
  wilaya_ids:    number[]
  boutique_ids:  string[]
  manages_stock: boolean
  is_active:     boolean
}

// ── Constants ──────────────────────────────────────────────────────────────

const LIMIT = 25

const EMPTY_FORM: CarrierForm = {
  name: '', phone: '', platform: '',
  wilaya_ids: [], boutique_ids: [],
  manages_stock: false, is_active: true,
}

// ── Helpers ────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

// ── Toggle switch ──────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        position: 'relative', display: 'inline-block',
        width: 36, height: 20, borderRadius: 10,
        background: value ? colors.primary : '#ccc',
        border: 'none', cursor: 'pointer',
        flexShrink: 0, transition: 'background 0.18s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: value ? 18 : 2, width: 16, height: 16,
        borderRadius: '50%', background: '#fff',
        transition: 'left 0.18s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

// ── Action buttons ─────────────────────────────────────────────────────────

function ActionBtns({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation('common')
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button
        onClick={onEdit}
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
        <Pencil size={11} /> {t('actions.edit')}
      </button>
      <button
        onClick={onDelete}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11.5, padding: '3px 8px', borderRadius: 3,
          border: '1px solid #f5c6cb', background: '#fff8f8',
          color: colors.red, cursor: 'pointer', fontFamily: fonts.sans,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#fde8ea')}
        onMouseLeave={e => (e.currentTarget.style.background = '#fff8f8')}
      >
        <Trash2 size={11} /> {t('actions.delete')}
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LivreursPage() {
  const { t } = useTranslation('carriers')
  // List state
  const [carriers,     setCarriers]     = useState<Carrier[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [dbSearch,     setDbSearch]     = useState('')
  const [loading,      setLoading]      = useState(false)

  // Modal state
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editCarrier,  setEditCarrier]  = useState<Carrier | null>(null)
  const [form,         setForm]         = useState<CarrierForm>(EMPTY_FORM)
  const [formError,    setFormError]    = useState('')
  const [saving,       setSaving]       = useState(false)
  const [wilayaSearch, setWilayaSearch] = useState('')

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Carrier | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  // Reference data
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [wilayas,   setWilayas]   = useState<Wilaya[]>([])

  // ── Debounce search ───────────────────────────────────────────────────────

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(val: string) {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDbSearch(val); setPage(1) }, 300)
  }

  // ── Fetch reference data once on mount ────────────────────────────────────

  useEffect(() => {
    fetch('/api/wilayas')
      .then(r => r.json())
      .then((d: Wilaya[]) => { if (Array.isArray(d)) setWilayas(d) })
      .catch(() => {})

    fetch('/api/boutiques', { headers: authHeader() })
      .then(r => r.json())
      .then((d: Boutique[]) => { if (Array.isArray(d)) setBoutiques(d) })
      .catch(() => {})
  }, [])

  // ── Fetch carrier list ─────────────────────────────────────────────────────

  const fetchCarriers = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT), search: dbSearch })
    fetch(`/api/carriers?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.carriers)) setCarriers(d.carriers)
        if (typeof d.total === 'number') setTotal(d.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, dbSearch])

  useEffect(() => { fetchCarriers() }, [fetchCarriers])

  // ── Inline toggle (optimistic) ─────────────────────────────────────────────

  async function handleInlineToggle(carrier: Carrier, field: 'is_active' | 'manages_stock') {
    const updated = { ...carrier, [field]: !carrier[field] }
    setCarriers(prev => prev.map(c => c.id === carrier.id ? updated : c))

    const res = await fetch(`/api/carriers/${carrier.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        name:          carrier.name,
        phone:         carrier.phone,
        platform:      carrier.platform,
        wilaya_ids:    carrier.wilaya_ids,
        boutique_ids:  carrier.boutique_ids,
        manages_stock: updated.manages_stock,
        is_active:     updated.is_active,
      }),
    })
    if (!res.ok) {
      // Revert on failure
      setCarriers(prev => prev.map(c => c.id === carrier.id ? carrier : c))
    }
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditCarrier(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setWilayaSearch('')
    setModalOpen(true)
  }

  function openEdit(carrier: Carrier) {
    setEditCarrier(carrier)
    setForm({
      name:          carrier.name,
      phone:         carrier.phone         ?? '',
      platform:      carrier.platform      ?? '',
      wilaya_ids:    carrier.wilaya_ids    ?? [],
      boutique_ids:  carrier.boutique_ids  ?? [],
      manages_stock: carrier.manages_stock,
      is_active:     carrier.is_active,
    })
    setFormError('')
    setWilayaSearch('')
    setModalOpen(true)
  }

  function closeModal() { setModalOpen(false); setFormError('') }

  function toggleWilaya(id: number) {
    setForm(f => ({
      ...f,
      wilaya_ids: f.wilaya_ids.includes(id)
        ? f.wilaya_ids.filter(w => w !== id)
        : [...f.wilaya_ids, id],
    }))
  }

  function toggleBoutique(id: string) {
    setForm(f => ({
      ...f,
      boutique_ids: f.boutique_ids.includes(id)
        ? f.boutique_ids.filter(b => b !== id)
        : [...f.boutique_ids, id],
    }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!form.name.trim()) { setFormError(t('nameRequired')); return }

    setSaving(true)
    setFormError('')
    try {
      const body = {
        name:          form.name.trim(),
        phone:         form.phone.trim()    || null,
        platform:      form.platform.trim() || null,
        wilaya_ids:    form.wilaya_ids,
        boutique_ids:  form.boutique_ids,
        manages_stock: form.manages_stock,
        is_active:     form.is_active,
      }
      const url    = editCarrier ? `/api/carriers/${editCarrier.id}` : '/api/carriers'
      const method = editCarrier ? 'PUT' : 'POST'

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
      fetchCarriers()
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/carriers/${deleteTarget.id}`, {
        method: 'DELETE', headers: authHeader(),
      })
      if (res.ok) { setDeleteTarget(null); fetchCarriers() }
    } finally {
      setDeleting(false)
    }
  }

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns: Column<Carrier>[] = [
    {
      key: 'name', label: t('common:fields.name'),
      render: row => (
        <span style={{ fontWeight: 500, color: colors.text }}>{row.name}</span>
      ),
    },
    {
      key: 'phone', label: t('common:fields.phone'), width: 135,
      render: row => (
        <span style={{ color: row.phone ? colors.textMd : colors.textLt, fontSize: 12 }}>
          {row.phone ?? '—'}
        </span>
      ),
    },
    {
      key: 'platform', label: t('cols.platform'), width: 130,
      render: row => (
        <span style={{ color: row.platform ? colors.textMd : colors.textLt, fontSize: 12 }}>
          {row.platform ?? '—'}
        </span>
      ),
    },
    {
      key: 'wilaya_ids', label: t('cols.wilayas'), width: 90,
      render: row => (
        <Badge color={row.wilaya_ids.length > 0 ? 'blue' : 'gray'}>
          {t('wilayasBadge', { count: row.wilaya_ids.length })}
        </Badge>
      ),
    },
    {
      key: 'boutique_ids', label: t('cols.boutiques'), width: 100,
      render: row => (
        <Badge color={row.boutique_ids.length > 0 ? 'green' : 'gray'}>
          {t('boutiquesBadge', { count: row.boutique_ids.length })}
        </Badge>
      ),
    },
    {
      key: 'manages_stock', label: t('cols.managesStock'), width: 100,
      render: row => (
        <Toggle
          value={row.manages_stock}
          onChange={() => handleInlineToggle(row, 'manages_stock')}
        />
      ),
    },
    {
      key: 'is_active', label: t('cols.status'), width: 80,
      render: row => (
        <Toggle
          value={row.is_active}
          onChange={() => handleInlineToggle(row, 'is_active')}
        />
      ),
    },
    {
      key: 'actions', label: t('common:fields.actions'), width: 165,
      render: row => (
        <ActionBtns onEdit={() => openEdit(row)} onDelete={() => setDeleteTarget(row)} />
      ),
    },
  ]

  // ── Filtered wilayas (in modal) ───────────────────────────────────────────

  const filteredWilayas = wilayaSearch.trim()
    ? wilayas.filter(w =>
        w.name.toLowerCase().includes(wilayaSearch.toLowerCase()) ||
        String(w.id).includes(wilayaSearch.trim())
      )
    : wilayas

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder={t('searchPlaceholder')}
          />
          <span style={{ fontSize: 12, color: colors.textMd, fontFamily: fonts.sans }}>
            {loading ? '…' : t('count', { count: total })}
          </span>
        </div>

        <Table<Carrier>
          columns={columns}
          data={carriers}
          loading={loading}
          emptyText={t('empty')}
        />

        {total > LIMIT && (
          <Pagination page={page} total={total} limit={LIMIT} onChange={p => setPage(p)} />
        )}
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editCarrier ? t('editModalTitle') : t('addModalTitle')}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Nom + Téléphone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Input
              label={t('common:fields.name')}
              value={form.name}
              onChange={v => setForm(f => ({ ...f, name: v }))}
              placeholder={t('namePlaceholder')}
              required
            />
            <Input
              label={t('common:fields.phone')}
              value={form.phone}
              onChange={v => setForm(f => ({ ...f, phone: v }))}
              placeholder={t('phonePlaceholder')}
            />
          </div>

          {/* Plateforme + Statut + Gère stock */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <Input
              label={t('platformLabel')}
              value={form.platform}
              onChange={v => setForm(f => ({ ...f, platform: v }))}
              placeholder={t('platformPlaceholder')}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: colors.text, fontFamily: fonts.sans }}>
                {t('statusLabel')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 5 }}>
                <Toggle value={form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <span style={{ fontSize: 12, color: colors.textMd, fontFamily: fonts.sans }}>
                  {form.is_active ? t('active') : t('inactive')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: colors.text, fontFamily: fonts.sans }}>
                {t('managesStockLabel')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 5 }}>
                <Toggle value={form.manages_stock} onChange={v => setForm(f => ({ ...f, manages_stock: v }))} />
                <span style={{ fontSize: 12, color: colors.textMd, fontFamily: fonts.sans }}>
                  {form.manages_stock ? t('yes') : t('no')}
                </span>
              </div>
            </div>
          </div>

          {/* Boutiques associées */}
          {boutiques.length > 0 && (
            <div>
              <span style={{
                fontSize: 12, fontWeight: 500, color: colors.text,
                fontFamily: fonts.sans, display: 'block', marginBottom: 8,
              }}>
                {t('associatedBoutiques')}
              </span>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 6, padding: 10,
                border: `1px solid ${colors.border}`,
                borderRadius: 5, background: '#fafafa',
              }}>
                {boutiques.map(b => (
                  <label key={b.id} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    cursor: 'pointer', fontSize: 12,
                    color: form.boutique_ids.includes(b.id) ? colors.primary : colors.text,
                    fontFamily: fonts.sans,
                    padding: '4px 6px', borderRadius: 4,
                    background: form.boutique_ids.includes(b.id) ? colors.primaryLt : 'transparent',
                  }}>
                    <input
                      type="checkbox"
                      checked={form.boutique_ids.includes(b.id)}
                      onChange={() => toggleBoutique(b.id)}
                      style={{ accentColor: colors.primary, width: 13, height: 13 }}
                    />
                    {b.name}
                    {b.prefix && (
                      <span style={{ fontSize: 10, color: colors.textLt, marginLeft: 2 }}>
                        ({b.prefix})
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Wilayas couvertes */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: colors.text, fontFamily: fonts.sans }}>
                {t('coveredWilayas')}
              </span>
              {form.wilaya_ids.length > 0 && (
                <span style={{
                  fontSize: 11, background: colors.primaryLt, color: colors.primary,
                  padding: '1px 7px', borderRadius: 10, fontFamily: fonts.sans,
                }}>
                  {t('selectedCount', { count: form.wilaya_ids.length })}
                </span>
              )}
              {form.wilaya_ids.length > 0 && (
                <button
                  onClick={() => setForm(f => ({ ...f, wilaya_ids: [] }))}
                  style={{
                    fontSize: 11, color: colors.textLt, background: 'none',
                    border: 'none', cursor: 'pointer', fontFamily: fonts.sans,
                    padding: 0, textDecoration: 'underline',
                  }}
                >
                  {t('deselectAll')}
                </button>
              )}
            </div>

            <div style={{ border: `1px solid ${colors.border}`, borderRadius: 5, overflow: 'hidden' }}>
              {/* Search bar */}
              <div style={{
                padding: '6px 10px',
                borderBottom: `1px solid ${colors.border}`,
                background: '#fafafa',
              }}>
                <input
                  type="text"
                  placeholder={t('filterWilayas')}
                  value={wilayaSearch}
                  onChange={e => setWilayaSearch(e.target.value)}
                  style={{
                    width: '100%', border: 'none', outline: 'none',
                    fontSize: 12, color: colors.text,
                    background: 'transparent', fontFamily: fonts.sans,
                  }}
                />
              </div>

              {/* Scrollable 3-column list */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1px 0', maxHeight: 200, overflowY: 'auto',
                padding: '6px 8px', background: '#fff',
              }}>
                {filteredWilayas.map(w => (
                  <label key={w.id} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    cursor: 'pointer', fontSize: 11.5,
                    fontFamily: fonts.sans, padding: '3px 4px', borderRadius: 3,
                    color: form.wilaya_ids.includes(w.id) ? colors.primary : colors.text,
                    background: form.wilaya_ids.includes(w.id) ? colors.primaryLt : 'transparent',
                  }}>
                    <input
                      type="checkbox"
                      checked={form.wilaya_ids.includes(w.id)}
                      onChange={() => toggleWilaya(w.id)}
                      style={{ accentColor: colors.primary, width: 13, height: 13 }}
                    />
                    {String(w.id).padStart(2, '0')} {w.name}
                  </label>
                ))}
                {filteredWilayas.length === 0 && (
                  <span style={{
                    fontSize: 12, color: colors.textLt,
                    padding: 8, gridColumn: '1 / -1', fontFamily: fonts.sans,
                  }}>
                    {t('noWilaya')}
                  </span>
                )}
              </div>
            </div>
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
            {editCarrier ? t('common:actions.save') : t('common:actions.add')}
          </Button>
        </div>
      </Modal>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('deleteTitle')}
        message={t('deleteConfirm', { name: deleteTarget?.name ?? '' })}
        confirmLabel={deleting ? t('deleting') : t('common:actions.delete')}
        danger
      />
    </>
  )
}
