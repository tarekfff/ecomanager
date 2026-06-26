'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import {
  PageHeader, Table, Pagination, Modal, Button,
  Input, Select, Badge, SearchInput, ConfirmDialog,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

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

// ── Helpers ────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ActionBtns({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
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
        <Pencil size={11} /> Modifier
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
        <Trash2 size={11} /> Supprimer
      </button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ClientsPage() {
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
    fetch(`/api/clients?${qs}`, { headers: authHeader() })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.clients)) setClients(data.clients)
        if (typeof data.total === 'number') setTotal(data.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, dbSearch])

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
    if (!form.full_name.trim()) { setFormError('Le nom complet est requis.'); return }
    if (!form.phone.trim())     { setFormError('Le téléphone est requis.');   return }

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
      const url    = editClient ? `/api/clients/${editClient.id}` : '/api/clients'
      const method = editClient ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setFormError((err as { error?: string }).error ?? 'Erreur lors de la sauvegarde.')
        return
      }
      setModalOpen(false)
      fetchClients()
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/clients/${deleteTarget.id}`, {
        method: 'DELETE', headers: authHeader(),
      })
      if (res.ok) { setDeleteTarget(null); fetchClients() }
    } finally {
      setDeleting(false)
    }
  }

  // ── Table columns ─────────────────────────────────────────────────────────

  const columns: Column<Client>[] = [
    {
      key: 'full_name', label: 'Nom complet',
      render: row => <span style={{ fontWeight: 500, color: colors.text }}>{row.full_name}</span>,
    },
    { key: 'phone', label: 'Téléphone', width: 135 },
    {
      key: 'wilaya_name', label: 'Wilaya', width: 140,
      render: row => (
        <span style={{ color: row.wilaya_name ? colors.textMd : colors.textLt, fontSize: 12 }}>
          {row.wilaya_name ?? '—'}
        </span>
      ),
    },
    {
      key: 'orders_delivered', label: 'Livrés', width: 75,
      render: row => <Badge color="green">{row.orders_delivered}</Badge>,
    },
    {
      key: 'orders_returned', label: 'Retournés', width: 90,
      render: row => <Badge color="red">{row.orders_returned}</Badge>,
    },
    {
      key: 'orders_cancelled', label: 'Annulés', width: 80,
      render: row => <Badge color="orange">{row.orders_cancelled}</Badge>,
    },
    {
      key: 'actions', label: 'Actions', width: 165,
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
    ? 'Chargement…'
    : form.wilaya_id
      ? 'Sélectionner une commune'
      : 'Sélectionnez d\'abord une wilaya'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Header */}
      <PageHeader
        title="Clients"
        subtitle="Gestion de la base clients"
        actions={
          <Button variant="primary" size="sm" onClick={openAdd}>
            + Ajouter un client
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
            placeholder="Rechercher par nom ou téléphone…"
          />
          <span style={{ fontSize: 12, color: colors.textMd, fontFamily: fonts.sans }}>
            {loading ? '…' : `${total} client${total !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Table */}
        <Table<Client>
          columns={columns}
          data={clients}
          loading={loading}
          emptyText="Aucun client trouvé"
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
        title={editClient ? 'Modifier le client' : 'Ajouter un client'}
        size="md"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Full-width: name */}
          <div style={{ gridColumn: '1 / -1' }}>
            <Input
              label="Nom complet"
              value={form.full_name}
              onChange={setField('full_name')}
              placeholder="Ex : Ahmed Benali"
              required
            />
          </div>

          {/* Phone row */}
          <Input
            label="Téléphone"
            value={form.phone}
            onChange={setField('phone')}
            placeholder="0555 00 00 00"
            required
          />
          <Input
            label="Téléphone 2"
            value={form.phone2}
            onChange={setField('phone2')}
            placeholder="Optionnel"
          />

          {/* Email */}
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={setField('email')}
            placeholder="client@example.com"
          />

          {/* Wilaya */}
          <Select
            label="Wilaya"
            value={form.wilaya_id}
            onChange={handleWilayaChange}
            options={wilayaOptions}
            placeholder="Sélectionner une wilaya"
          />

          {/* Commune — cascades from Wilaya */}
          <Select
            label="Commune"
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
              label="Adresse"
              value={form.address}
              onChange={setField('address')}
              placeholder="Ex : Rue 12, Cité Ennasr"
            />
          </div>
        </div>

        {formError && (
          <p style={{ fontSize: 12, color: colors.red, marginTop: 10, fontFamily: fonts.sans }}>
            {formError}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button variant="secondary" size="sm" onClick={closeModal}>Annuler</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            {editClient ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </div>
      </Modal>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer le client"
        message={`Supprimer « ${deleteTarget?.full_name} » ? Cette action est irréversible et peut échouer si le client possède des commandes.`}
        confirmLabel={deleting ? 'Suppression…' : 'Supprimer'}
        danger
      />
    </>
  )
}
