'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Pencil, Ban, Check, X } from 'lucide-react'
import { colors, fonts } from '@/lib/tokens'
import PageHeader from '@/components/ui/PageHeader'
import Table, { Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import SearchInput from '@/components/ui/SearchInput'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppUser {
  id: string
  name: string
  email: string
  email_verified: boolean
  two_fa_enabled: boolean
  is_online: boolean
  last_seen_at: string | null
  is_active: boolean
  created_at: string
  role_ids: string[]
  role_names: string[]
  boutique_ids: string[]
}

interface Role { id: string; name: string }
interface Boutique { id: string; name: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    'Content-Type': 'application/json',
  }
}

const ONLINE_WINDOW_MS = 5 * 60 * 1000

// A user counts as online when explicitly flagged OR seen within the last 5 min
function isOnline(u: AppUser): boolean {
  if (u.is_online) return true
  if (!u.last_seen_at) return false
  return Date.now() - new Date(u.last_seen_at).getTime() < ONLINE_WINDOW_MS
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

function BoolMark({ value }: { value: boolean }) {
  return value
    ? <Check size={15} style={{ color: colors.green }} />
    : <X size={15} style={{ color: colors.textLt }} />
}

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: colors.textMd }}>
      <span style={{
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: online ? colors.green : colors.textLt,
        display: 'inline-block',
        boxShadow: online ? `0 0 0 2px ${colors.green}33` : 'none',
      }} />
      {online ? 'En ligne' : 'Hors ligne'}
    </span>
  )
}

// ─── Multi-select (checkbox list) ─────────────────────────────────────────────

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  emptyText,
}: {
  label: string
  options: { id: string; name: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
  emptyText: string
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: fonts.sans }}>
      <label style={{ fontSize: 12.5, color: colors.textMd, marginBottom: 4, fontWeight: 500 }}>
        {label}
      </label>
      <div style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        maxHeight: 140,
        overflowY: 'auto',
        background: '#fff',
      }}>
        {options.length === 0 ? (
          <div style={{ padding: '10px 12px', fontSize: 12.5, color: colors.textLt }}>{emptyText}</div>
        ) : (
          options.map((opt, i) => {
            const checked = selected.includes(opt.id)
            return (
              <label
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  fontSize: 13,
                  color: colors.text,
                  cursor: 'pointer',
                  borderTop: i > 0 ? `1px solid ${colors.border}` : 'none',
                  background: checked ? colors.primaryLt : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.id)}
                  style={{ accentColor: colors.primary, cursor: 'pointer' }}
                />
                {opt.name}
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role_ids: [] as string[],
  boutique_ids: [] as string[],
  is_active: true,
}

export default function UtilisateursPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [boutiques, setBoutiques] = useState<Boutique[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [disableUser, setDisableUser] = useState<AppUser | null>(null)

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadUsers = useCallback(() => {
    setLoading(true)
    fetch('/api/users?all=1', { headers: authHeader() })
      .then(r => r.json())
      .then(d => setUsers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadUsers()
    fetch('/api/roles', { headers: authHeader() })
      .then(r => r.json())
      .then(d => setRoles(Array.isArray(d) ? d : []))
      .catch(() => {})
    fetch('/api/config/boutiques', { headers: authHeader() })
      .then(r => r.json())
      .then(d => setBoutiques(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [loadUsers])

  // Refresh online status periodically (recompute against last_seen_at)
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role_names.some(r => r.toLowerCase().includes(q))
    )
  }, [users, search])

  // ── Modal handlers ───────────────────────────────────────────────────────────

  function openAdd() {
    setEditUser(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(u: AppUser) {
    setEditUser(u)
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role_ids: u.role_ids,
      boutique_ids: u.boutique_ids,
      is_active: u.is_active,
    })
    setFormError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { setFormError('Le nom est requis'); return }
    if (!form.email.trim()) { setFormError('L’email est requis'); return }
    if (!editUser && form.password.length < 6) {
      setFormError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }

    setSaving(true)
    try {
      const url = editUser ? `/api/users/${editUser.id}` : '/api/users'
      const method = editUser ? 'PUT' : 'POST'
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        role_ids: form.role_ids,
        boutique_ids: form.boutique_ids,
        is_active: form.is_active,
      }
      // On create the password is always sent; on edit only when non-empty
      if (!editUser || form.password.length > 0) payload.password = form.password

      const res = await fetch(url, { method, headers: authHeader(), body: JSON.stringify(payload) })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Erreur' }))
        throw new Error(error ?? 'Erreur')
      }
      setModalOpen(false)
      loadUsers()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  // Toggle is_active directly from the table
  async function toggleActive(u: AppUser) {
    const next = !u.is_active
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: next } : x))
    await fetch(`/api/users/${u.id}`, {
      method: 'PUT',
      headers: authHeader(),
      body: JSON.stringify({ is_active: next }),
    }).catch(() => {})
  }

  async function handleDisable() {
    if (!disableUser) return
    await fetch(`/api/users/${disableUser.id}`, { method: 'DELETE', headers: authHeader() }).catch(() => {})
    setDisableUser(null)
    loadUsers()
  }

  // ── Table columns ────────────────────────────────────────────────────────────

  const columns: Column<AppUser>[] = [
    {
      key: 'name',
      label: 'Nom',
      render: u => (
        <span style={{ fontWeight: 500, color: u.is_active ? colors.text : colors.textLt }}>
          {u.name}
        </span>
      ),
    },
    { key: 'email', label: 'Email', render: u => <span style={{ color: colors.textMd }}>{u.email}</span> },
    {
      key: 'roles',
      label: 'Rôle(s)',
      render: u => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {u.role_names.length === 0
            ? <span style={{ color: colors.textLt, fontSize: 12 }}>—</span>
            : u.role_names.map((r, i) => <Badge key={i} color="purple">{r}</Badge>)}
        </div>
      ),
    },
    {
      key: 'email_verified',
      label: 'Email vérifié',
      width: 100,
      render: u => <div style={{ display: 'flex', justifyContent: 'center' }}><BoolMark value={u.email_verified} /></div>,
    },
    {
      key: 'two_fa_enabled',
      label: '2FA',
      width: 70,
      render: u => <div style={{ display: 'flex', justifyContent: 'center' }}><BoolMark value={u.two_fa_enabled} /></div>,
    },
    {
      key: 'online',
      label: 'En ligne',
      width: 110,
      render: u => <OnlineDot online={isOnline(u)} />,
    },
    {
      key: 'is_active',
      label: 'Actif',
      width: 70,
      render: u => <Toggle checked={u.is_active} onChange={() => toggleActive(u)} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 90,
      render: u => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button
            onClick={() => openEdit(u)}
            title="Modifier"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textMd, padding: 4, borderRadius: 4, display: 'flex' }}
          >
            <Pencil size={14} />
          </button>
          {u.is_active && (
            <button
              onClick={() => setDisableUser(u)}
              title="Désactiver"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.red, padding: 4, borderRadius: 4, display: 'flex' }}
            >
              <Ban size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: fonts.sans }}>
      <PageHeader
        title="Utilisateurs"
        subtitle="Gérez les comptes, rôles et boutiques associées"
        actions={
          <Button onClick={openAdd} size="sm">
            <Plus size={13} />
            Nouvel utilisateur
          </Button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: colors.bg }}>
        <div style={{ marginBottom: 12, maxWidth: 320 }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un utilisateur…" />
        </div>

        <Table columns={columns} data={filtered} loading={loading} emptyText="Aucun utilisateur" />
      </div>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editUser ? 'Modifier l’utilisateur' : 'Nouvel utilisateur'}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Nom"
            value={form.name}
            onChange={v => { setForm(f => ({ ...f, name: v })); setFormError('') }}
            placeholder="ex: Ahmed Benali"
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={v => { setForm(f => ({ ...f, email: v })); setFormError('') }}
            placeholder="ex: ahmed@exemple.com"
            required
          />
          <Input
            label={editUser ? 'Mot de passe' : 'Mot de passe'}
            type="password"
            value={form.password}
            onChange={v => { setForm(f => ({ ...f, password: v })); setFormError('') }}
            placeholder={editUser ? 'Laisser vide pour ne pas changer' : 'Au moins 6 caractères'}
            required={!editUser}
          />

          <MultiSelect
            label="Rôles"
            options={roles}
            selected={form.role_ids}
            onChange={ids => setForm(f => ({ ...f, role_ids: ids }))}
            emptyText="Aucun rôle disponible"
          />

          <MultiSelect
            label="Boutiques associées"
            options={boutiques}
            selected={form.boutique_ids}
            onChange={ids => setForm(f => ({ ...f, boutique_ids: ids }))}
            emptyText="Aucune boutique disponible"
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Toggle checked={form.is_active} onChange={v => setForm(f => ({ ...f, is_active: v }))} />
            <span style={{ fontSize: 13, color: colors.textMd }}>Compte actif</span>
          </div>

          {formError && (
            <div style={{ fontSize: 12, color: colors.red }}>{formError}</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleSave} loading={saving}>
              {editUser ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!disableUser}
        onClose={() => setDisableUser(null)}
        onConfirm={handleDisable}
        title="Désactiver l’utilisateur"
        message={`Désactiver le compte de ${disableUser?.name ?? ''} ? Il ne pourra plus se connecter. Vous pourrez le réactiver à tout moment.`}
        confirmLabel="Désactiver"
        danger
      />
    </div>
  )
}
