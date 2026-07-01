'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, Copy, ChevronDown, ChevronRight, ArrowLeft, ShieldCheck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { colors, fonts } from '@/lib/tokens'
import PageHeader from '@/components/ui/PageHeader'
import Table, { Column } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Role {
  id: string
  name: string
  permissions: Record<string, boolean>
  is_system: boolean
}

type Perm = { key: string; label: string }
type PermSection = { id: string; group: string; label: string; perms: Perm[] }

// ─── Permission Matrix Data (stable keys only — labels resolved via t()) ──────

type PermDef = { key: string }
type PermSectionDef = { id: string; groupKey: string; perms: PermDef[] }

const PERM_SECTIONS_DEF: PermSectionDef[] = [
  // ── Commandes ────────────────────────────────────────────────────────────
  { id: 'orders.en_confirmation', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'confirm' }, { key: 'cancel' }, { key: 'delete' },
    { key: 'assign_confirmer' }, { key: 'edit_discount' }, { key: 'edit_price' },
    { key: 'edit_delivery_fee' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.en_preparation', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'cancel' }, { key: 'change_carrier' },
    { key: 'dispatch' }, { key: 'print_labels' }, { key: 'export' },
    { key: 'edit' }, { key: 'edit_discount' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.en_dispatch', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'cancel' }, { key: 'go_back' }, { key: 'change_carrier' },
    { key: 'print_labels' }, { key: 'print_route' }, { key: 'ship' },
    { key: 'export' }, { key: 'edit' }, { key: 'disable_sync' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.en_livraison', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'track' }, { key: 'request_return' },
    { key: 'validate_delivery' }, { key: 'edit' }, { key: 'edit_carrier_fee' },
    { key: 'disable_sync' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.livrees', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'prepare_bon' },
    { key: 'edit' }, { key: 'edit_carrier_fee' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.en_retour', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'prepare_bon' },
    { key: 'validate_return' }, { key: 'edit' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.archive_encaissees', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.archive_retournees', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.archive_annulees', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'delete' }, { key: 'restore' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.corbeille', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'undo_delete' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.bon_encaissement', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'confirm' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.bon_retour', groupKey: 'Commandes', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'confirm' }, { key: 'bulk_action' },
  ]},
  // ── Pickups ──────────────────────────────────────────────────────────────
  { id: 'orders.pickups_en_collecte', groupKey: 'Pickups', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'cancel' }, { key: 'delete' },
    { key: 'edit' }, { key: 'validate_collect' }, { key: 'disable_sync' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.pickups_collecte', groupKey: 'Pickups', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'edit' }, { key: 'prepare_bon' },
    { key: 'validate_reception' }, { key: 'disable_sync' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.pickups_recus', groupKey: 'Pickups', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'edit' },
    { key: 'validate_processing' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.pickups_traites', groupKey: 'Pickups', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'bulk_action' },
  ]},
  { id: 'orders.pickups_annules', groupKey: 'Pickups', perms: [
    { key: 'view' }, { key: 'go_back' }, { key: 'delete' }, { key: 'bulk_action' },
  ]},
  // ── Other modules ─────────────────────────────────────────────────────────
  { id: 'stats', groupKey: 'Statistiques', perms: [
    { key: 'boutique' }, { key: 'product' }, { key: 'delivery' },
    { key: 'confirmation' }, { key: 'order' },
  ]},
  { id: 'data', groupKey: 'Données', perms: [
    { key: 'export' }, { key: 'reports' },
  ]},
  { id: 'products', groupKey: 'Produits', perms: [
    { key: 'view' }, { key: 'create' }, { key: 'edit' }, { key: 'trash' },
    { key: 'move_to_trash' }, { key: 'restore' }, { key: 'delete' },
  ]},
  { id: 'stock', groupKey: 'Stock', perms: [
    { key: 'adjust' }, { key: 'movements' }, { key: 'batches' }, { key: 'alerts' },
    { key: 'inventory' }, { key: 'mega_inventory' }, { key: 'view_purchase_price' },
  ]},
  { id: 'brands', groupKey: 'Catalogue', perms: [
    { key: 'create' }, { key: 'edit' }, { key: 'delete' },
  ]},
  { id: 'suppliers', groupKey: 'Catalogue', perms: [
    { key: 'create' }, { key: 'edit' }, { key: 'delete' },
  ]},
  { id: 'accounting', groupKey: 'Comptabilité', perms: [
    { key: 'bilan' }, { key: 'product_profitability' }, { key: 'enter_expenses' },
  ]},
  { id: 'webhooks', groupKey: 'Webhooks', perms: [
    { key: 'create' }, { key: 'edit' }, { key: 'delete' }, { key: 'view_logs' },
  ]},
  { id: 'config', groupKey: 'Configuration', perms: [
    { key: 'sources' }, { key: 'clients' }, { key: 'delivery' }, { key: 'boutiques' },
    { key: 'statuses' }, { key: 'users' }, { key: 'roles' }, { key: 'subscription' },
    { key: 'advanced' },
  ]},
  { id: 'other', groupKey: 'Autre', perms: [
    { key: 'view_unassigned_orders' }, { key: 'view_order_logs' },
  ]},
]

const TOTAL_PERMS = PERM_SECTIONS_DEF.reduce((sum, s) => sum + s.perms.length, 0)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeader() {
  return {
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    'Content-Type': 'application/json',
  }
}

function countEnabled(perms: Record<string, boolean>): number {
  return Object.values(perms).filter(v => v === true).length
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: {
  checked: boolean
  onChange?: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange?.(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none',
        background: checked ? colors.primary : colors.border,
        position: 'relative', cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.2s', flexShrink: 0, opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', display: 'block',
      }} />
    </button>
  )
}

// ─── SectionCard ─────────────────────────────────────────────────────────────

function SectionCard({
  section, permissions, superAdmin, expanded, onToggleExpand, onChange,
}: {
  section: PermSection
  permissions: Record<string, boolean>
  superAdmin: boolean
  expanded: boolean
  onToggleExpand: () => void
  onChange: (key: string, value: boolean) => void
}) {
  const { t } = useTranslation('config')
  const checkedCount = superAdmin
    ? section.perms.length
    : section.perms.filter(p => permissions[`${section.id}.${p.key}`]).length
  const allChecked = checkedCount === section.perms.length

  function handleToggleAll(e: React.MouseEvent) {
    e.stopPropagation()
    const next = !allChecked
    section.perms.forEach(p => onChange(`${section.id}.${p.key}`, next))
  }

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${colors.border}`,
      borderRadius: 4,
      overflow: 'hidden',
    }}>
      <div
        onClick={onToggleExpand}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          cursor: 'pointer', userSelect: 'none',
          background: expanded ? '#fafafa' : '#fff',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5' }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = expanded ? '#fafafa' : '#fff' }}
      >
        {expanded
          ? <ChevronDown size={13} style={{ color: colors.textLt, flexShrink: 0 }} />
          : <ChevronRight size={13} style={{ color: colors.textLt, flexShrink: 0 }} />
        }
        <span style={{ fontSize: 13, fontWeight: 500, color: colors.text, flex: 1 }}>
          {section.label}
        </span>
        <span style={{ fontSize: 11, color: checkedCount > 0 ? colors.primary : colors.textLt, fontWeight: 500 }}>
          {checkedCount}/{section.perms.length}
        </span>
        {!superAdmin && (
          <button
            onClick={handleToggleAll}
            style={{
              background: 'none', border: `1px solid ${colors.border}`,
              borderRadius: 3, padding: '2px 8px', fontSize: 11,
              color: colors.textMd, cursor: 'pointer', marginLeft: 4,
              fontFamily: fonts.sans,
            }}
          >
            {allChecked ? t('roles.edit.uncheckAll') : t('roles.edit.checkAll')}
          </button>
        )}
      </div>

      {expanded && (
        <div style={{
          borderTop: `1px solid ${colors.border}`,
          padding: '10px 16px 14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '8px 16px',
        }}>
          {section.perms.map(p => {
            const fullKey = `${section.id}.${p.key}`
            const checked = superAdmin ? true : !!permissions[fullKey]
            return (
              <label
                key={p.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 13, color: superAdmin ? colors.textMd : colors.text,
                  cursor: superAdmin ? 'not-allowed' : 'pointer', userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={superAdmin}
                  onChange={e => onChange(fullKey, e.target.checked)}
                  style={{
                    accentColor: colors.primary,
                    width: 14, height: 14,
                    cursor: superAdmin ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                  }}
                />
                {p.label}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { t } = useTranslation('config')

  // Build translated PERM_SECTIONS inside the component so labels update on lang change
  const PERM_SECTIONS: PermSection[] = PERM_SECTIONS_DEF.map(s => ({
    id: s.id,
    group: t(`roles.groups.${s.groupKey}`),
    label: t(`roles.sections.${s.id.replace(/\./g, '_')}`),
    perms: s.perms.map(p => ({ key: p.key, label: t(`roles.actions.${p.key}`, { defaultValue: p.key }) })),
  }))

  const GROUPS = Array.from(new Set(PERM_SECTIONS.map(s => s.group)))

  // ── List state ────────────────────────────────────────────────────────────
  const [roles, setRoles] = useState<Role[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)

  // ── View state ────────────────────────────────────────────────────────────
  const [view, setView] = useState<'list' | 'edit'>('list')

  // ── Edit form state ───────────────────────────────────────────────────────
  const [editRole, setEditRole] = useState<Role | null>(null)
  const [roleName, setRoleName] = useState('')
  const [nameError, setNameError] = useState('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadRoles = useCallback(() => {
    setLoadingList(true)
    fetch('/api/roles', { headers: authHeader() })
      .then(r => r.json())
      .then(d => setRoles(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }, [])

  useEffect(() => { loadRoles() }, [loadRoles])

  // ── Open new / edit ───────────────────────────────────────────────────────

  function openNew() {
    setEditRole(null)
    setRoleName('')
    setNameError('')
    setPermissions({})
    setIsSuperAdmin(false)
    setExpandedSections(new Set())
    setSaveError('')
    setView('edit')
  }

  function openEdit(role: Role) {
    const isSA = role.permissions['*'] === true
    setEditRole(role)
    setRoleName(role.name)
    setNameError('')
    setPermissions(isSA ? {} : { ...role.permissions })
    setIsSuperAdmin(isSA)
    setExpandedSections(new Set())
    setSaveError('')
    setView('edit')
  }

  // ── Duplicate ─────────────────────────────────────────────────────────────

  async function duplicate(role: Role) {
    await fetch('/api/roles', {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({
        name: t('roles.duplicate.name', { name: role.name }),
        permissions: role.permissions,
      }),
    }).catch(() => {})
    loadRoles()
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    await fetch(`/api/roles/${deleteTarget.id}`, { method: 'DELETE', headers: authHeader() })
      .catch(() => {})
    setDeleteTarget(null)
    loadRoles()
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    const name = roleName.trim()
    if (!name) { setNameError(t('roles.edit.errName')); return }

    const finalPerms: Record<string, boolean> = isSuperAdmin
      ? { '*': true }
      : Object.fromEntries(Object.entries(permissions).filter(([, v]) => v === true))

    setSaving(true)
    setSaveError('')
    try {
      const url = editRole ? `/api/roles/${editRole.id}` : '/api/roles'
      const method = editRole ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: authHeader(),
        body: JSON.stringify({ name, permissions: finalPerms }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Erreur' }))
        throw new Error(error ?? 'Erreur')
      }
      setView('list')
      loadRoles()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  // ── Permission helpers ────────────────────────────────────────────────────

  function handlePermChange(key: string, value: boolean) {
    setPermissions(prev => ({ ...prev, [key]: value }))
  }

  const enabledCount = useMemo(
    () => isSuperAdmin ? TOTAL_PERMS : countEnabled(permissions),
    [isSuperAdmin, permissions],
  )

  const allExpanded = PERM_SECTIONS.every(s => expandedSections.has(s.id))

  function toggleAllExpanded() {
    setExpandedSections(
      allExpanded ? new Set() : new Set(PERM_SECTIONS.map(s => s.id))
    )
  }

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── List table columns ────────────────────────────────────────────────────

  const columns: Column<Role>[] = [
    {
      key: 'name',
      label: t('roles.cols.name'),
      render: r => (
        <span style={{ fontWeight: 500, color: colors.text }}>{r.name}</span>
      ),
    },
    {
      key: 'type',
      label: t('roles.cols.type'),
      width: 110,
      render: r => (
        r.is_system
          ? <Badge color="blue">{t('roles.badge.system')}</Badge>
          : <Badge color="green">{t('roles.badge.custom')}</Badge>
      ),
    },
    {
      key: 'permissions',
      label: t('roles.cols.permissions'),
      width: 180,
      render: r => {
        if (r.permissions['*'] === true) {
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <ShieldCheck size={13} style={{ color: colors.primary }} />
              <span style={{ color: colors.primary, fontWeight: 600 }}>Super Admin</span>
            </span>
          )
        }
        const n = countEnabled(r.permissions)
        return (
          <span style={{ fontSize: 12, color: n > 0 ? colors.textMd : colors.textLt }}>
            {t('roles.permCount', { count: n, total: TOTAL_PERMS })}
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: t('roles.cols.actions'),
      width: 110,
      render: r => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button onClick={() => openEdit(r)} title={t('roles.tooltipEdit')} style={iconBtn()}>
            <Pencil size={14} />
          </button>
          <button onClick={() => duplicate(r)} title={t('roles.tooltipDuplicate')} style={iconBtn()}>
            <Copy size={14} />
          </button>
          {!r.is_system && (
            <button onClick={() => setDeleteTarget(r)} title={t('roles.tooltipDelete')} style={iconBtn(true)}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────

  if (view === 'edit') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: fonts.sans }}>
        {/* Sticky edit header */}
        <div style={{
          background: '#fff',
          borderBottom: `1px solid ${colors.border}`,
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}>
          <button
            onClick={() => setView('list')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.textMd, display: 'flex', alignItems: 'center',
              gap: 4, fontSize: 13, padding: '4px 6px', borderRadius: 4,
              fontFamily: fonts.sans,
            }}
          >
            <ArrowLeft size={15} />
            {t('roles.edit.back')}
          </button>

          <div style={{ width: 1, height: 20, background: colors.border }} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <input
              value={roleName}
              onChange={e => { setRoleName(e.target.value); setNameError('') }}
              placeholder={t('roles.edit.namePh')}
              style={{
                border: `1px solid ${nameError ? colors.red : colors.border}`,
                borderRadius: 4, padding: '5px 10px', fontSize: 13,
                color: colors.text, fontFamily: fonts.sans, outline: 'none',
                width: 280,
              }}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = colors.primary }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = nameError ? colors.red : colors.border }}
            />
            {nameError && (
              <span style={{ fontSize: 11, color: colors.red, marginTop: 2 }}>{nameError}</span>
            )}
          </div>

          <span style={{ fontSize: 12, color: colors.textLt, whiteSpace: 'nowrap' }}>
            {t('roles.permCount', { count: enabledCount, total: TOTAL_PERMS })}
          </span>

          <button
            onClick={toggleAllExpanded}
            style={{
              background: 'none', border: `1px solid ${colors.border}`,
              borderRadius: 4, padding: '5px 10px', fontSize: 12,
              color: colors.textMd, cursor: 'pointer', fontFamily: fonts.sans,
              whiteSpace: 'nowrap',
            }}
          >
            {allExpanded ? t('roles.edit.collapseAll') : t('roles.edit.expandAll')}
          </button>

          <Button size="sm" onClick={handleSave} loading={saving}>
            {t('roles.edit.saveBtn')}
          </Button>
        </div>

        {/* Scrollable permission matrix */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: colors.bg }}>
          {saveError && (
            <div style={{
              background: '#fff3cd', border: '1px solid #ffc107',
              borderRadius: 4, padding: '8px 12px', marginBottom: 12,
              fontSize: 13, color: '#856404',
            }}>
              {saveError}
            </div>
          )}

          {/* Super Admin card */}
          <div style={{
            background: isSuperAdmin ? colors.primaryLt : '#fff',
            border: `1px solid ${isSuperAdmin ? colors.primary : colors.border}`,
            borderRadius: 6,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            transition: 'background 0.2s, border-color 0.2s',
          }}>
            <Toggle checked={isSuperAdmin} onChange={setIsSuperAdmin} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
                {t('roles.edit.superAdminTitle')}
              </div>
              <div style={{ fontSize: 12, color: colors.textMd, marginTop: 1 }}>
                {t('roles.edit.superAdminDesc')}
              </div>
            </div>
            {isSuperAdmin && (
              <ShieldCheck size={20} style={{ color: colors.primary }} />
            )}
          </div>

          {/* Groups */}
          {GROUPS.map(group => {
            const secs = PERM_SECTIONS.filter(s => s.group === group)
            return (
              <div key={group} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: colors.textLt,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  marginBottom: 8, padding: '0 2px',
                }}>
                  {group}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {secs.map(section => (
                    <SectionCard
                      key={section.id}
                      section={section}
                      permissions={permissions}
                      superAdmin={isSuperAdmin}
                      expanded={expandedSections.has(section.id)}
                      onToggleExpand={() => toggleSection(section.id)}
                      onChange={handlePermChange}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: fonts.sans }}>
      <PageHeader
        title={t('roles.title')}
        subtitle={t('roles.subtitle')}
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus size={13} />
            {t('roles.addBtn')}
          </Button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: colors.bg }}>
        <Table
          columns={columns}
          data={roles}
          loading={loadingList}
          emptyText={t('roles.empty')}
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('roles.delete.title')}
        message={t('roles.delete.message', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('roles.delete.confirmBtn')}
        danger
      />
    </div>
  )
}

// ─── Shared icon button style ─────────────────────────────────────────────────

function iconBtn(danger = false): React.CSSProperties {
  return {
    background: 'none', border: 'none', cursor: 'pointer',
    color: danger ? colors.red : colors.textMd,
    padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center',
  }
}
