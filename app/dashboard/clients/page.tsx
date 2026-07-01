'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Users } from 'lucide-react'
import {
  PageHeader, Table, Pagination, Modal, Button,
  Input, Select, Badge, SearchInput, ConfirmDialog, EmptyState,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'
import { useToast } from '@/contexts/ToastContext'
import { apiGet, apiPost, apiPut, apiDelete, errorMessage } from '@/lib/api-client'

// ── Types ──────────────────────────────────────────────────────────────────

interface Client {
  id:               string
  full_name:        string
  phone:            string
  phone2?:          string | null
  email?:           string | null
  address?:         string | null
  wilaya_id?:       number | null
  wilaya_name?:     string | null
  commune_id?:      number | null
  orders_delivered: number
  orders_returned:  number
  orders_cancelled: number
  created_at:       string
}

interface Wilaya  { id: number; name: string }
interface Commune { id: number; name: string }

interface ClientForm {
  full_name:  string
  phone:      string
  phone2:     string
  email:      string
  address:    string
  wilaya_id:  string
  commune_id: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const LIMIT = 25

const EMPTY_FORM: ClientForm = {
  full_name: '', phone: '', phone2: '', email: '',
  address: '', wilaya_id: '', commune_id: '',
}

// ── Sub-components ─────────────────────────────────────────────────────────

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

export default function ClientsPage() {
  const toast = useToast()
  const { t } = useTranslation('clients')

  // List state
  const [clients,      setClients]      = useState<Client[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(1)
  const [search,       setSearch]       = useState('')
  const [dbSearch,     setDbSearch]     = useState('')
  const [loading,      setLoading]      = useState(false)

  // Modal state
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editClient,   setEditClient]   = useState<Client | null>(null)
  const [form,         setForm]         = useState<ClientForm>(EMPTY_FORM)
  const [formError,    setFormError]    = useState('')
  const [saving,       setSaving]       = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  // Reference data
  const [wilayas,         setWilayas]         = useState<Wilaya[]>([])
  const [communes,        setCommunes]        = useState<Commune[]>([])
  const [communesLoading, setCommunesLoading] = useState(false)

  // ── Debounce search ───────────────────────────────────────────────────────

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(val: string) {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDbSearch(val); setPage(1) }, 300)
  }

  // ── Fetch wilayas once on mount ───────────────────────────────────────────

  useEffect(() => {
    fetch('/api/wilayas')
      .then(r => r.json())
      .then((data: Wilaya[]) => { if (Array.isArray(data)) setWilayas(data) })
      .catch(() => {})
  }, [])

  // ── Fetch communes whenever wilaya changes (only while modal is open) ─────

  useEffect(() => {
    if (!modalOpen || !form.wilaya_id) {
      setCommunes([])
      return
    }
    setCommunesLoading(true)
    fetch(`/api/communes?wilaya_id=${form.wilaya_id}`)
      .then(r => r.json())
      .then((data: Commune[]) => { if (Array.isArray(data)) setCommunes(data) })
      .catch(() => setCommunes([]))
      .finally(() => setCommunesLoading(false))
  }, [form.wilaya_id, modalOpen])

  // ── Fetch client list ─────────────────────────────────────────────────────

  const fetchClients = useCallback(() => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT), search: dbSearch })
    apiGet<{ clients: Client[]; total: number }>(`/api/clients?${qs}`)
      .then(data => {
        if (Array.isArray(data.clients)) setClients(data.clients)
        if (typeof data.total === 'number') setTotal(data.total)
      })
      .catch(e => toast.error(errorMessage(e, t('errors.loadError'))))
      .finally(() => setLoading(false))
  }, [page, dbSearch, toast, t])

  useEffect(() => { fetchClients() }, [fetchClients])

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditClient(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(client: Client) {
    setEditClient(client)
    setForm({
      full_name:  client.full_name,
      phone:      client.phone,
      phone2:     client.phone2    ?? '',
      email:      client.email     ?? '',
      address:    client.address   ?? '',
      wilaya_id:  client.wilaya_id  ? String(client.wilaya_id)  : '',
      commune_id: client.commune_id ? String(client.commune_id) : '',
    })
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setFormError('')
  }

  function setField(key: keyof ClientForm) {
    return (val: string) => setForm(f => ({ ...f, [key]: val }))
  }

  // Changing wilaya resets the dependent commune
  function handleWilayaChange(val: string) {
    setForm(f => ({ ...f, wilaya_id: val, commune_id: '' }))
  }

  // ── Save (POST for add, PUT for edit) ─────────────────────────────────────

  async function handleSave() {
    if (!form.full_name.trim()) { setFormError(t('errors.nameRequired'));  return }
    if (!form.phone.trim())     { setFormError(t('errors.phoneRequired')); return }

    setSaving(true)
    setFormError('')
    try {
      const body = {
        full_name:  form.full_name.trim(),
        phone:      form.phone.trim(),
        phone2:     form.phone2.trim()   || null,
        email:      form.email.trim()    || null,
        address:    form.address.trim()  || null,
        wilaya_id:  form.wilaya_id  || null,
        commune_id: form.commune_id || null,
      }
      if (editClient) await apiPut(`/api/clients/${editClient.id}`, body)
      else            await apiPost('/api/clients', body)

      toast.success(editClient ? t('toast.updated') : t('toast.added'))
      setModalOpen(false)
      fetchClients()
    } catch (e) {
      const msg = errorMessage(e, t('errors.saveError'))
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await apiDelete(`/api/clients/${deleteTarget.id}`)
      toast.success(t('toast.deleted'))
      setDeleteTarget(null)
      fetchClients()
    } catch (e) {
      toast.error(errorMessage(e, t('errors.deleteError')))
    } finally {
      setDeleting(false)
    }
  }

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns: Column<Client>[] = [
    {
      key: 'full_name', label: t('table.full_name'),
      render: row => <span style={{ fontWeight: 500, color: colors.text }}>{row.full_name}</span>,
    },
    { key: 'phone', label: t('table.phone'), width: 135 },
    {
      key: 'wilaya_name', label: t('table.wilaya'), width: 140,
      render: row => (
        <span style={{ color: row.wilaya_name ? colors.textMd : colors.textLt, fontSize: 12 }}>
          {row.wilaya_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'orders_delivered', label: t('table.delivered'), width: 75,
      render: row => <Badge color="green">{row.orders_delivered}</Badge>,
    },
    {
      key: 'orders_returned', label: t('table.returned'), width: 90,
      render: row => <Badge color="red">{row.orders_returned}</Badge>,
    },
    {
      key: 'orders_cancelled', label: t('table.cancelled'), width: 80,
      render: row => <Badge color="orange">{row.orders_cancelled}</Badge>,
    },
    {
      key: 'actions', label: t('table.actions'), width: 165,
      render: row => (
        <ActionBtns onEdit={() => openEdit(row)} onDelete={() => setDeleteTarget(row)} />
      ),
    },
  ]

  // ── Derived options ───────────────────────────────────────────────────────

  const wilayaOptions = wilayas.map(w => ({
    value: String(w.id),
    label: `${String(w.id).padStart(2, '0')} — ${w.name}`,
  }))

  const communeOptions = communes.map(c => ({ value: String(c.id), label: c.name }))

  const communePlaceholder = communesLoading
    ? t('common:loading')
    : form.wilaya_id
      ? t('form.communePlaceholder')
      : t('form.communePlaceholderFirst')

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button variant="primary" size="sm" onClick={openAdd}>
            {t('addClient')}
          </Button>
        }
      />

      {/* Content area */}
      <div style={{
        flex: 1, overflow: 'auto', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>

        {/* Toolbar */}
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

        {/* Table */}
        <Table<Client>
          columns={columns}
          data={clients}
          loading={loading}
          empty={
            dbSearch ? (
              <EmptyState
                icon={Users}
                title={t('empty.title')}
                message={t('empty.noResults', { q: dbSearch })}
              />
            ) : (
              <EmptyState
                icon={Users}
                title={t('empty.title')}
                message={t('empty.message')}
                actionLabel={t('empty.action')}
                onAction={openAdd}
              />
            )
          }
        />

        {/* Pagination */}
        {total > LIMIT && (
          <Pagination page={page} total={total} limit={LIMIT} onChange={p => { setPage(p) }} />
        )}
      </div>

      {/* ── Add / Edit Modal ──────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editClient ? t('modal.editTitle') : t('modal.addTitle')}
        size="md"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Full-width: name */}
          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label={t('form.fullName')}
              value={form.full_name}
              onChange={setField('full_name')}
              placeholder={t('form.namePlaceholder')}
              required
            />
          </div>

          {/* Phone row */}
          <Input
            label={t('form.phone')}
            value={form.phone}
            onChange={setField('phone')}
            placeholder="0555 00 00 00"
            required
          />
          <Input
            label={t('form.phone2')}
            value={form.phone2}
            onChange={setField('phone2')}
            placeholder={t('form.optional')}
          />

          {/* Email */}
          <Input
            label={t('form.email')}
            type="email"
            value={form.email}
            onChange={setField('email')}
            placeholder={t('form.emailPlaceholder')}
          />

          {/* Wilaya */}
          <Select
            label={t('form.wilaya')}
            value={form.wilaya_id}
            onChange={handleWilayaChange}
            options={wilayaOptions}
            placeholder={t('form.wilayaPlaceholder')}
          />

          {/* Commune — cascades from Wilaya */}
          <Select
            label={t('form.commune')}
            value={form.commune_id}
            onChange={setField('commune_id')}
            options={communeOptions}
            placeholder={communePlaceholder}
            disabled={!form.wilaya_id || communesLoading}
          />

          {/* Empty cell to keep grid balanced when commune is on right */}
          <div />

          {/* Full-width: address */}
          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label={t('form.address')}
              value={form.address}
              onChange={setField('address')}
              placeholder={t('form.addressPlaceholder')}
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
            {editClient ? t('form.save') : t('form.add')}
          </Button>
        </div>
      </Modal>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('delete.title')}
        message={t('delete.message', { name: deleteTarget?.full_name ?? '' })}
        confirmLabel={deleting ? t('delete.deleting') : t('common:actions.delete')}
        danger
      />
    </>
  )
}
