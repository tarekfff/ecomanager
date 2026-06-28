'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, Copy, ChevronDown, ChevronRight, ArrowLeft, ShieldCheck,
} from 'lucide-react'
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

// ─── Permission Matrix Data ───────────────────────────────────────────────────

type Perm = { key: string; label: string }
type PermSection = { id: string; group: string; label: string; perms: Perm[] }

const PERM_SECTIONS: PermSection[] = [
  // ── Commandes ────────────────────────────────────────────────────────────
  { id: 'orders.en_confirmation', group: 'Commandes', label: 'En confirmation', perms: [
    { key: 'view',              label: 'Voir' },
    { key: 'confirm',           label: 'Confirmer' },
    { key: 'cancel',            label: 'Annuler' },
    { key: 'delete',            label: 'Supprimer' },
    { key: 'assign_confirmer',  label: 'Assigner confirmateur' },
    { key: 'edit_discount',     label: 'Modifier remise' },
    { key: 'edit_price',        label: 'Modifier prix' },
    { key: 'edit_delivery_fee', label: 'Modifier frais livraison' },
    { key: 'bulk_action',       label: 'Actions en masse' },
  ]},
  { id: 'orders.en_preparation', group: 'Commandes', label: 'En préparation', perms: [
    { key: 'view',           label: 'Voir' },
    { key: 'go_back',        label: 'Retourner' },
    { key: 'cancel',         label: 'Annuler' },
    { key: 'change_carrier', label: 'Changer livreur' },
    { key: 'dispatch',       label: 'Dispatcher' },
    { key: 'print_labels',   label: 'Imprimer étiquettes' },
    { key: 'export',         label: 'Exporter' },
    { key: 'edit',           label: 'Modifier' },
    { key: 'edit_discount',  label: 'Modifier remise' },
    { key: 'bulk_action',    label: 'Actions en masse' },
  ]},
  { id: 'orders.en_dispatch', group: 'Commandes', label: 'En dispatch', perms: [
    { key: 'view',           label: 'Voir' },
    { key: 'cancel',         label: 'Annuler' },
    { key: 'go_back',        label: 'Retourner' },
    { key: 'change_carrier', label: 'Changer livreur' },
    { key: 'print_labels',   label: 'Imprimer étiquettes' },
    { key: 'print_route',    label: 'Feuille de route' },
    { key: 'ship',           label: 'Expédier' },
    { key: 'export',         label: 'Exporter' },
    { key: 'edit',           label: 'Modifier' },
    { key: 'disable_sync',   label: 'Désactiver sync' },
    { key: 'bulk_action',    label: 'Actions en masse' },
  ]},
  { id: 'orders.en_livraison', group: 'Commandes', label: 'En livraison', perms: [
    { key: 'view',              label: 'Voir' },
    { key: 'go_back',           label: 'Retourner' },
    { key: 'track',             label: 'Suivre' },
    { key: 'request_return',    label: 'Demander retour' },
    { key: 'validate_delivery', label: 'Valider livraison' },
    { key: 'edit',              label: 'Modifier' },
    { key: 'edit_carrier_fee',  label: 'Modifier frais livreur' },
    { key: 'disable_sync',      label: 'Désactiver sync' },
    { key: 'bulk_action',       label: 'Actions en masse' },
  ]},
  { id: 'orders.livrees', group: 'Commandes', label: 'Livrées', perms: [
    { key: 'view',             label: 'Voir' },
    { key: 'go_back',          label: 'Retourner' },
    { key: 'prepare_bon',      label: 'Préparer bon' },
    { key: 'edit',             label: 'Modifier' },
    { key: 'edit_carrier_fee', label: 'Modifier frais livreur' },
    { key: 'bulk_action',      label: 'Actions en masse' },
  ]},
  { id: 'orders.en_retour', group: 'Commandes', label: 'En retour', perms: [
    { key: 'view',            label: 'Voir' },
    { key: 'go_back',         label: 'Retourner' },
    { key: 'prepare_bon',     label: 'Préparer bon' },
    { key: 'validate_return', label: 'Valider retour' },
    { key: 'edit',            label: 'Modifier' },
    { key: 'bulk_action',     label: 'Actions en masse' },
  ]},
  { id: 'orders.archive_encaissees', group: 'Commandes', label: 'Archive encaissées', perms: [
    { key: 'view',        label: 'Voir' },
    { key: 'go_back',     label: 'Retourner' },
    { key: 'bulk_action', label: 'Actions en masse' },
  ]},
  { id: 'orders.archive_retournees', group: 'Commandes', label: 'Archive retournées', perms: [
    { key: 'view',        label: 'Voir' },
    { key: 'go_back',     label: 'Retourner' },
    { key: 'bulk_action', label: 'Actions en masse' },
  ]},
  { id: 'orders.archive_annulees', group: 'Commandes', label: 'Archive annulées', perms: [
    { key: 'view',        label: 'Voir' },
    { key: 'delete',      label: 'Supprimer' },
    { key: 'restore',     label: 'Restaurer' },
    { key: 'bulk_action', label: 'Actions en masse' },
  ]},
  { id: 'orders.corbeille', group: 'Commandes', label: 'Corbeille', perms: [
    { key: 'view',         label: 'Voir' },
    { key: 'undo_delete',  label: 'Annuler suppression' },
    { key: 'bulk_action',  label: 'Actions en masse' },
  ]},
  { id: 'orders.bon_encaissement', group: 'Commandes', label: "Bon d'encaissement", perms: [
    { key: 'view',        label: 'Voir' },
    { key: 'go_back',     label: 'Retourner' },
    { key: 'confirm',     label: 'Confirmer' },
    { key: 'bulk_action', label: 'Actions en masse' },
  ]},
  { id: 'orders.bon_retour', group: 'Commandes', label: 'Bon de retour', perms: [
    { key: 'view',        label: 'Voir' },
    { key: 'go_back',     label: 'Retourner' },
    { key: 'confirm',     label: 'Confirmer' },
    { key: 'bulk_action', label: 'Actions en masse' },
  ]},
  // ── Pickups ──────────────────────────────────────────────────────────────
  { id: 'orders.pickups_en_collecte', group: 'Pickups', label: 'En collecte', perms: [
    { key: 'view',             label: 'Voir' },
    { key: 'go_back',          label: 'Retourner' },
    { key: 'cancel',           label: 'Annuler' },
    { key: 'delete',           label: 'Supprimer' },
    { key: 'edit',             label: 'Modifier' },
    { key: 'validate_collect', label: 'Valider collecte' },
    { key: 'disable_sync',     label: 'Désactiver sync' },
    { key: 'bulk_action',      label: 'Actions en masse' },
  ]},
  { id: 'orders.pickups_collecte', group: 'Pickups', label: 'Collecté', perms: [
    { key: 'view',               label: 'Voir' },
    { key: 'go_back',            label: 'Retourner' },
    { key: 'edit',               label: 'Modifier' },
    { key: 'prepare_bon',        label: 'Préparer bon' },
    { key: 'validate_reception', label: 'Valider réception' },
    { key: 'disable_sync',       label: 'Désactiver sync' },
    { key: 'bulk_action',        label: 'Actions en masse' },
  ]},
  { id: 'orders.pickups_recus', group: 'Pickups', label: 'Reçu', perms: [
    { key: 'view',                label: 'Voir' },
    { key: 'go_back',             label: 'Retourner' },
    { key: 'edit',                label: 'Modifier' },
    { key: 'validate_processing', label: 'Valider traitement' },
    { key: 'bulk_action',         label: 'Actions en masse' },
  ]},
  { id: 'orders.pickups_traites', group: 'Pickups', label: 'Traité', perms: [
    { key: 'view',        label: 'Voir' },
    { key: 'go_back',     label: 'Retourner' },
    { key: 'bulk_action', label: 'Actions en masse' },
  ]},
  { id: 'orders.pickups_annules', group: 'Pickups', label: 'Annulé', perms: [
    { key: 'view',        label: 'Voir' },
    { key: 'go_back',     label: 'Retourner' },
    { key: 'delete',      label: 'Supprimer' },
    { key: 'bulk_action', label: 'Actions en masse' },
  ]},
  // ── Other modules ─────────────────────────────────────────────────────────
  { id: 'stats', group: 'Statistiques', label: 'Statistiques', perms: [
    { key: 'boutique',     label: 'Par boutique' },
    { key: 'product',      label: 'Par produit' },
    { key: 'delivery',     label: 'Livraison' },
    { key: 'confirmation', label: 'Confirmation' },
    { key: 'order',        label: 'Commandes' },
  ]},
  { id: 'data', group: 'Données', label: 'Données', perms: [
    { key: 'export',   label: 'Exporter' },
    { key: 'reports',  label: 'Rapports' },
  ]},
  { id: 'products', group: 'Produits', label: 'Produits', perms: [
    { key: 'view',         label: 'Voir' },
    { key: 'create',       label: 'Créer' },
    { key: 'edit',         label: 'Modifier' },
    { key: 'trash',        label: 'Corbeille' },
    { key: 'move_to_trash',label: 'Mettre à la corbeille' },
    { key: 'restore',      label: 'Restaurer' },
    { key: 'delete',       label: 'Supprimer' },
  ]},
  { id: 'stock', group: 'Stock', label: 'Stock', perms: [
    { key: 'adjust',              label: 'Ajuster' },
    { key: 'movements',           label: 'Mouvements' },
    { key: 'batches',             label: 'Lots' },
    { key: 'alerts',              label: 'Alertes' },
    { key: 'inventory',           label: 'Inventaire' },
    { key: 'mega_inventory',      label: 'Méga-inventaire' },
    { key: 'view_purchase_price', label: "Voir prix d'achat" },
  ]},
  { id: 'brands', group: 'Catalogue', label: 'Marques', perms: [
    { key: 'create', label: 'Créer' },
    { key: 'edit',   label: 'Modifier' },
    { key: 'delete', label: 'Supprimer' },
  ]},
  { id: 'suppliers', group: 'Catalogue', label: 'Fournisseurs', perms: [
    { key: 'create', label: 'Créer' },
    { key: 'edit',   label: 'Modifier' },
    { key: 'delete', label: 'Supprimer' },
  ]},
  { id: 'accounting', group: 'Comptabilité', label: 'Comptabilité', perms: [
    { key: 'bilan',                  label: 'Bilan général' },
    { key: 'product_profitability',  label: 'Rentabilité produit' },
    { key: 'enter_expenses',         label: 'Saisir dépenses' },
  ]},
  { id: 'webhooks', group: 'Webhooks', label: 'Webhooks', perms: [
    { key: 'create',    label: 'Créer' },
    { key: 'edit',      label: 'Modifier' },
    { key: 'delete',    label: 'Supprimer' },
    { key: 'view_logs', label: 'Voir logs' },
  ]},
  { id: 'config', group: 'Configuration', label: 'Configuration', perms: [
    { key: 'sources',      label: "Sources d'import" },
    { key: 'clients',      label: 'Clients' },
    { key: 'delivery',     label: 'Livraison' },
    { key: 'boutiques',    label: 'Boutiques' },
    { key: 'statuses',     label: 'Statuts' },
    { key: 'users',        label: 'Utilisateurs' },
    { key: 'roles',        label: 'Rôles' },
    { key: 'subscription', label: 'Abonnement' },
    { key: 'advanced',     label: 'Avancé' },
  ]},
  { id: 'other', group: 'Autre', label: 'Autre', perms: [
    { key: 'view_unassigned_orders', label: 'Voir commandes non assignées' },
    { key: 'view_order_logs',        label: 'Voir historique commandes' },
  ]},
]

const TOTAL_PERMS = PERM_SECTIONS.reduce((sum, s) => sum + s.perms.length, 0)
const GROUPS = Array.from(new Set(PERM_SECTIONS.map(s => s.group)))

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
      {/* Section header */}
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
            {allChecked ? 'Tout décocher' : 'Tout cocher'}
          </button>
        )}
      </div>

      {/* Permissions grid */}
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
        name: `Copie de ${role.name}`,
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
    if (!name) { setNameError('Le nom est requis'); return }

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
      label: 'Nom',
      render: r => (
        <span style={{ fontWeight: 500, color: colors.text }}>{r.name}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: 110,
      render: r => (
        r.is_system
          ? <Badge color="blue">Système</Badge>
          : <Badge color="green">Personnalisé</Badge>
      ),
    },
    {
      key: 'permissions',
      label: 'Permissions',
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
            {n} / {TOTAL_PERMS} permissions
          </span>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 110,
      render: r => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <button
            onClick={() => openEdit(r)}
            title="Modifier"
            style={iconBtn()}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => duplicate(r)}
            title="Dupliquer"
            style={iconBtn()}
          >
            <Copy size={14} />
          </button>
          {!r.is_system && (
            <button
              onClick={() => setDeleteTarget(r)}
              title="Supprimer"
              style={iconBtn(true)}
            >
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
            Retour
          </button>

          <div style={{ width: 1, height: 20, background: colors.border }} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <input
              value={roleName}
              onChange={e => { setRoleName(e.target.value); setNameError('') }}
              placeholder="Nom du rôle…"
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
            {enabledCount} / {TOTAL_PERMS} permissions
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
            {allExpanded ? 'Tout fermer' : 'Tout ouvrir'}
          </button>

          <Button size="sm" onClick={handleSave} loading={saving}>
            Enregistrer
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
                Super Administrateur
              </div>
              <div style={{ fontSize: 12, color: colors.textMd, marginTop: 1 }}>
                Accès complet à toutes les fonctionnalités — désactive la matrice ci-dessous
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
        title="Rôles"
        subtitle="Définissez les niveaux d'accès de vos collaborateurs"
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus size={13} />
            Nouveau rôle
          </Button>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: colors.bg }}>
        <Table
          columns={columns}
          data={roles}
          loading={loadingList}
          emptyText="Aucun rôle configuré"
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Supprimer le rôle"
        message={`Supprimer le rôle "${deleteTarget?.name ?? ''}" ? Les utilisateurs ayant ce rôle perdront ses permissions.`}
        confirmLabel="Supprimer"
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
