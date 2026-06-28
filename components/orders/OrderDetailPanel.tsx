'use client'

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react'
import {
  X, User, Phone, MapPin, Mail, Package,
  Truck, CreditCard, Clock, ChevronDown,
  CheckCircle, XCircle, UserCheck, Tag,
  AlertCircle, Activity, RotateCcw, RefreshCw,
  Wifi, WifiOff, Send, PackageCheck, Pencil, FileText,
} from 'lucide-react'
import { Button, Select } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Client {
  id:       string
  full_name: string
  phone:    string
  phone2:   string | null
  email:    string | null
  address:  string | null
}

interface OrderItem {
  id:           string
  product_name: string
  sku:          string
  quantity:     number
  unit_price:   number
  line_total:   number
}

interface OrderDetail {
  id:                    string
  reference:             string
  tracking_status:       string
  confirmation_status:   string | null
  delivery_status:       string | null
  total:                 number
  subtotal:              number
  delivery_fee:          number
  carrier_fee:           number
  discount:              number
  delivery_method:       string
  return_risk_score:     number | null
  address:               string | null
  phone:                 string
  phone2:                string | null
  remark:                string | null
  referrer:              string | null
  source_type:           string
  boutique_id:           string
  sync_enabled:          boolean
  deleted_at:            string | null
  created_at:            string
  confirmed_at:          string | null
  dispatched_at:         string | null
  shipped_at:            string | null
  delivered_at:          string | null
  cancelled_at:          string | null
  client:                Client | null
  wilaya_name:           string | null
  commune_name:          string | null
  confirmer_name:        string | null
  carrier_name:          string | null
  items:                 OrderItem[]
}

interface OrderLog {
  id:         string
  action:     string
  new_values: Record<string, unknown> | null
  created_at: string
  user_name:  string | null
}

interface AppUser        { id: string; name: string }
interface Carrier        { id: string; name: string }
interface DeliveryStatus { id: string; name: string; slug: string }

export interface OrderDetailPanelProps {
  orderId:        string | null
  onClose:        () => void
  onStatusChange: () => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TRACKING_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  en_confirmation: { label: 'En confirmation', color: '#1565C0', bg: '#E3F2FD' },
  en_preparation:  { label: 'En préparation',  color: '#6A1B9A', bg: '#F3E5F5' },
  en_dispatch:     { label: 'En dispatch',     color: '#E65100', bg: '#FFF3E0' },
  en_livraison:    { label: 'En livraison',    color: '#37474F', bg: '#ECEFF1' },
  livree:          { label: 'Livrée',          color: '#1B5E20', bg: '#E8F5E9' },
  en_retour:       { label: 'En retour',       color: '#B71C1C', bg: '#FFEBEE' },
  retournee:       { label: 'Retournée',       color: '#880E4F', bg: '#FCE4EC' },
  encaissee:       { label: 'Encaissée',       color: '#004D40', bg: '#E0F2F1' },
  annulee:         { label: 'Annulée',         color: '#616161', bg: '#F5F5F5' },
}

const CONF_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  echec_1:            { label: 'Échec 1',       color: '#E65100', bg: '#FFF3E0' },
  echec_2:            { label: 'Échec 2',       color: '#D84315', bg: '#FBE9E7' },
  echec_3:            { label: 'Échec 3',       color: '#B71C1C', bg: '#FFEBEE' },
  suspendue:          { label: 'Suspendue',     color: '#546E7A', bg: '#ECEFF1' },
  annulation_demande: { label: 'Ann. demandée', color: '#C62828', bg: '#FFEBEE' },
}

const CONF_STATUS_OPTIONS = Object.entries(CONF_LABELS).map(([value, { label }]) => ({ value, label }))

const LOG_LABELS: Record<string, string> = {
  created:                  'Commande créée',
  confirm:                  'Confirmée → En préparation',
  cancel:                   'Annulée',
  assign_confirmer:         'Confirmateur affecté',
  set_confirmation_status:  'Statut confirmation modifié',
  delete:                   'Supprimée',
  dispatch:               'Dispatché → En dispatch',
  assign_carrier:          'Livreur affecté',
  go_back_to_confirmation: 'Retour en confirmation',
  ship:                    'Expédié → En livraison',
  toggle_sync:             'Synchronisation modifiée',
  go_back_to_preparation:  'Retour en préparation',
  updated:                 'Commande modifiée',
  deliver:                 'Livrée',
  request_return:          'Retour demandé → En retour',
  set_delivery_status:     'Statut livraison modifié',
  set_carrier_fee:         'Frais livreur modifiés',
  go_back_to_livraison:    'Retour en livraison',
  validate_return:         'Retour validé → Retournée',
  restore:                 'Restaurée → En confirmation',
  undo_delete:             'Suppression annulée',
  noest_push:              'Envoyée sur NOEST ✓',
  noest_push_failed:       'Échec envoi NOEST',
  noest_validate:          'Validée sur NOEST ✓',
  noest_return_requested:  'Retour demandé sur NOEST ✓',
  noest_new_attempt:       'Nouvelle tentative NOEST ✓',
}

const SOURCE_LABELS: Record<string, string> = {
  manual:       'Saisie manuelle',
  google_sheet: 'Google Sheet',
  shopify:      'Shopify',
  furulue:      'Furulue',
  api:          'API',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem('token') ?? ''}` }
}

function fmtAmt(n: number) {
  return n.toLocaleString('fr-DZ') + ' DA'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' })
}

// ── UI primitives ──────────────────────────────────────────────────────────────

function StatusPill({ slug, map }: { slug: string | null; map: typeof TRACKING_LABELS }) {
  if (!slug) return null
  const cfg = map[slug]
  if (!cfg) return <span style={{ fontSize: 11, color: colors.textMd }}>{slug}</span>
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10,
      color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function SectionCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 12px', background: '#f9f6f9',
        borderBottom: `1px solid ${colors.border}`,
        fontSize: 11, fontWeight: 700, color: colors.textMd,
        textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        <span style={{ color: colors.primary }}>{icon}</span>
        {title}
      </div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{ color: colors.textLt, marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10.5, color: colors.textLt, fontFamily: fonts.sans }}>{label}</div>
        <div style={{ fontSize: 12.5, color: colors.text, fontFamily: fonts.sans }}>{value}</div>
      </div>
    </div>
  )
}

function TotalRow({ label, value, bold, primary }: { label: string; value: string; bold?: boolean; primary?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: bold ? 14 : 12.5, fontWeight: bold ? 700 : 400, color: colors.textMd, fontFamily: fonts.sans }}>
        {label}
      </span>
      <span style={{
        fontSize: bold ? 18 : 12.5, fontWeight: bold ? 700 : 500,
        color: primary ? colors.primary : colors.text, fontFamily: fonts.sans,
      }}>
        {value}
      </span>
    </div>
  )
}

// ── NOEST helpers ─────────────────────────────────────────────────────────────

function tryParseNoestError(raw: string | undefined): string {
  if (!raw) return 'Erreur inconnue'
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    // Collect field-level validation messages
    const msgs: string[] = []
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'success') continue
      if (Array.isArray(v)) msgs.push(`${k}: ${v.join(', ')}`)
      else if (typeof v === 'string') msgs.push(v)
    }
    return msgs.length ? msgs.join(' | ') : raw
  } catch {
    return raw
  }
}

function NoestErrorBox({
  rawError, orderId, retrying, retryMsg, onRetry,
}: {
  rawError:  string | undefined
  orderId:   string | null
  retrying:  boolean
  retryMsg:  string
  onRetry:   () => void
}) {
  const msg = tryParseNoestError(rawError)
  return (
    <div style={{
      background: '#FFF3E0', border: '1px solid #FFB74D',
      borderRadius: 4, padding: '6px 10px', fontSize: 11.5,
    }}>
      <div style={{ color: '#E65100', fontWeight: 600, marginBottom: 2 }}>Erreur NOEST</div>
      <div style={{ color: '#795548', wordBreak: 'break-word', marginBottom: 6 }}>{msg}</div>
      {orderId && (
        <button
          onClick={onRetry}
          disabled={retrying}
          style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 4,
            border: '1px solid #FFB74D', background: '#fff',
            color: '#E65100', cursor: retrying ? 'not-allowed' : 'pointer',
            fontWeight: 600, opacity: retrying ? 0.6 : 1,
          }}
        >
          {retrying ? 'Envoi…' : 'Réessayer'}
        </button>
      )}
      {retryMsg && (
        <div style={{
          marginTop: 5, fontSize: 11,
          color: retryMsg.startsWith('✓') ? '#1B5E20' : '#B71C1C',
          fontWeight: 500,
        }}>
          {retryMsg}
        </div>
      )}
    </div>
  )
}

function Pulse() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
      {[80, 60, 90, 50, 70].map((w, i) => (
        <div key={i} style={{
          height: 14, borderRadius: 4, background: '#e8e8e8', width: `${w}%`,
          opacity: 0.6 + (i % 3) * 0.1,
        }} />
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OrderDetailPanel({ orderId, onClose, onStatusChange }: OrderDetailPanelProps) {
  const [order,           setOrder]           = useState<OrderDetail | null>(null)
  const [logs,            setLogs]            = useState<OrderLog[]>([])
  const [users,           setUsers]           = useState<AppUser[]>([])
  const [carriers,        setCarriers]        = useState<Carrier[]>([])
  const [deliveryStatuses, setDeliveryStatuses] = useState<DeliveryStatus[]>([])
  const [loading,         setLoading]         = useState(false)
  const [logsLoading,     setLogsLoading]     = useState(false)
  const [actionLoading,   setActionLoading]   = useState(false)
  const [actionError,     setActionError]     = useState('')
  const [mounted,         setMounted]         = useState(false)
  const [noestRetrying,   setNoestRetrying]   = useState(false)
  const [noestRetryMsg,   setNoestRetryMsg]   = useState('')

  // Carrier fee inline edit
  const [carrierFeeEditing, setCarrierFeeEditing] = useState(false)
  const [carrierFeeInput,   setCarrierFeeInput]   = useState('')

  // Dropdowns
  const [showAssign,        setShowAssign]        = useState(false)
  const [showConfStatus,    setShowConfStatus]     = useState(false)
  const [showDispatch,      setShowDispatch]       = useState(false)
  const [showCarrierMenu,   setShowCarrierMenu]    = useState(false)
  const [showDelivStatus,   setShowDelivStatus]    = useState(false)
  const assignRef        = useRef<HTMLDivElement>(null)
  const confStatusRef    = useRef<HTMLDivElement>(null)
  const dispatchRef      = useRef<HTMLDivElement>(null)
  const carrierMenuRef   = useRef<HTMLDivElement>(null)
  const delivStatusRef   = useRef<HTMLDivElement>(null)

  // Slide-in animation
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (assignRef.current      && !assignRef.current.contains(e.target as Node))      setShowAssign(false)
      if (confStatusRef.current  && !confStatusRef.current.contains(e.target as Node))  setShowConfStatus(false)
      if (dispatchRef.current    && !dispatchRef.current.contains(e.target as Node))    setShowDispatch(false)
      if (carrierMenuRef.current && !carrierMenuRef.current.contains(e.target as Node)) setShowCarrierMenu(false)
      if (delivStatusRef.current && !delivStatusRef.current.contains(e.target as Node)) setShowDelivStatus(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load users once
  useEffect(() => {
    fetch('/api/users', { headers: authHeader() })
      .then(r => r.json())
      .then((d: AppUser[]) => { if (Array.isArray(d)) setUsers(d) })
      .catch(() => {})
  }, [])

  // Load carriers when order's boutique is known
  useEffect(() => {
    if (!order?.boutique_id) return
    fetch('/api/carriers?limit=100', { headers: authHeader() })
      .then(r => r.json())
      .then((d: { carriers?: Carrier[] }) => {
        const list = d.carriers ?? []
        // Filter to carriers associated with this boutique
        setCarriers(list.filter((c: Carrier & { boutique_ids?: string[] }) =>
          !c.boutique_ids?.length || c.boutique_ids.includes(order.boutique_id)
        ))
      })
      .catch(() => {})
  }, [order?.boutique_id])

  // Load delivery statuses when order is en_livraison
  useEffect(() => {
    if (order?.tracking_status !== 'en_livraison') return
    fetch('/api/delivery-statuses', { headers: authHeader() })
      .then(r => r.json())
      .then((d: DeliveryStatus[]) => { if (Array.isArray(d)) setDeliveryStatuses(d) })
      .catch(() => {})
  }, [order?.tracking_status])

  // Fetch order details
  const fetchOrder = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setActionError('')
    try {
      const res = await fetch(`/api/orders/${orderId}`, { headers: authHeader() })
      const d   = await res.json() as OrderDetail & { error?: string }
      if (res.ok) setOrder(d)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!orderId) return
    setLogsLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/logs`, { headers: authHeader() })
      const d   = await res.json() as OrderLog[]
      if (Array.isArray(d)) setLogs(d)
    } finally {
      setLogsLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    setOrder(null)
    setLogs([])
    setActionError('')
    fetchOrder()
    fetchLogs()
  }, [fetchOrder, fetchLogs])

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function doAction(action: string, value?: string) {
    if (!orderId) return
    setActionLoading(true)
    setActionError('')
    setShowAssign(false)
    setShowConfStatus(false)
    setShowDispatch(false)
    setShowCarrierMenu(false)
    setShowDelivStatus(false)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body:    JSON.stringify({ action, value }),
      })
      const d = await res.json() as { error?: string }
      if (!res.ok) { setActionError(d.error ?? 'Erreur'); return }
      await fetchOrder()
      await fetchLogs()
      onStatusChange()
      // Close panel for status transitions that remove order from this view
      if (['confirm', 'cancel', 'dispatch', 'go_back_to_confirmation',
           'ship', 'go_back_to_preparation',
           'deliver', 'request_return',
           'go_back_to_livraison', 'validate_return',
           'restore', 'undo_delete'].includes(action)) onClose()
    } finally {
      setActionLoading(false)
    }
  }

  // ── Hard delete ──────────────────────────────────────────────────────────────

  async function doHardDelete() {
    if (!orderId) return
    if (!window.confirm('Supprimer définitivement cette commande ? Cette action est irréversible.')) return
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: 'DELETE', headers: authHeader() })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setActionError(d.error ?? 'Erreur')
        return
      }
      onStatusChange()
      onClose()
    } finally {
      setActionLoading(false)
    }
  }

  // ── Receipt creation ─────────────────────────────────────────────────────────

  async function doReceipt(type: 'encaissement' | 'retour') {
    if (!orderId) return
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch('/api/receipts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body:    JSON.stringify({ order_id: orderId, type }),
      })
      const d = await res.json() as { error?: string }
      if (!res.ok) { setActionError(d.error ?? 'Erreur'); return }
      await fetchLogs()
      onStatusChange()
    } finally {
      setActionLoading(false)
    }
  }

  // ── Render nothing if no orderId ─────────────────────────────────────────────

  if (!orderId) return null

  const o = order

  // ── Action buttons per tracking status ───────────────────────────────────────

  function renderActions() {
    if (!o) return null
    const status = o.tracking_status

    if (status === 'en_confirmation') {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Confirmer */}
          <Button
            variant="primary" size="sm"
            loading={actionLoading}
            onClick={() => doAction('confirm')}
          >
            <CheckCircle size={13} /> Confirmer
          </Button>

          {/* Annuler */}
          <Button
            variant="danger" size="sm"
            loading={actionLoading}
            onClick={() => doAction('cancel')}
          >
            <XCircle size={13} /> Annuler
          </Button>

          {/* Affecter à */}
          <div ref={assignRef} style={{ position: 'relative' }}>
            <Button
              variant="secondary" size="sm"
              loading={actionLoading}
              onClick={() => { setShowAssign(v => !v); setShowConfStatus(false) }}
            >
              <UserCheck size={13} /> Affecter à <ChevronDown size={11} />
            </Button>
            {showAssign && (
              <FloatingMenu>
                {users.length === 0 && (
                  <div style={{ padding: '10px 14px', fontSize: 12.5, color: colors.textLt }}>Aucun utilisateur</div>
                )}
                {users.map(u => (
                  <MenuBtn key={u.id} onClick={() => doAction('assign_confirmer', u.id)}>{u.name}</MenuBtn>
                ))}
              </FloatingMenu>
            )}
          </div>

          {/* Statut confirmation */}
          <div ref={confStatusRef} style={{ position: 'relative' }}>
            <Button
              variant="secondary" size="sm"
              loading={actionLoading}
              onClick={() => { setShowConfStatus(v => !v); setShowAssign(false) }}
            >
              <Tag size={13} /> Statut conf. <ChevronDown size={11} />
            </Button>
            {showConfStatus && (
              <FloatingMenu>
                {CONF_STATUS_OPTIONS.map(opt => (
                  <MenuBtn
                    key={opt.value}
                    onClick={() => doAction('set_confirmation_status', opt.value)}
                    color={CONF_LABELS[opt.value].color}
                  >
                    {opt.label}
                  </MenuBtn>
                ))}
              </FloatingMenu>
            )}
          </div>
        </div>
      )
    }

    if (status === 'en_preparation') {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Dispatcher */}
          <div ref={dispatchRef} style={{ position: 'relative' }}>
            <Button
              variant="primary" size="sm" loading={actionLoading}
              onClick={() => { setShowDispatch(v => !v); setShowCarrierMenu(false) }}
            >
              <Truck size={13} /> Dispatcher <ChevronDown size={11} />
            </Button>
            {showDispatch && (
              <FloatingMenu>
                {carriers.length === 0
                  ? <div style={{ padding: '10px 14px', fontSize: 12.5, color: colors.textLt }}>Aucun livreur disponible</div>
                  : carriers.map(c => (
                    <MenuBtn key={c.id} onClick={() => doAction('dispatch', c.id)}>{c.name}</MenuBtn>
                  ))
                }
              </FloatingMenu>
            )}
          </div>

          {/* Changer livreur */}
          <div ref={carrierMenuRef} style={{ position: 'relative' }}>
            <Button
              variant="secondary" size="sm" loading={actionLoading}
              onClick={() => { setShowCarrierMenu(v => !v); setShowDispatch(false) }}
            >
              <RefreshCw size={13} /> Changer livreur <ChevronDown size={11} />
            </Button>
            {showCarrierMenu && (
              <FloatingMenu>
                {carriers.length === 0
                  ? <div style={{ padding: '10px 14px', fontSize: 12.5, color: colors.textLt }}>Aucun livreur disponible</div>
                  : carriers.map(c => (
                    <MenuBtn key={c.id} onClick={() => doAction('assign_carrier', c.id)}>{c.name}</MenuBtn>
                  ))
                }
              </FloatingMenu>
            )}
          </div>

          {/* Annuler */}
          <Button
            variant="danger" size="sm" loading={actionLoading}
            onClick={() => doAction('cancel')}
          >
            <XCircle size={13} /> Annuler
          </Button>

          {/* Retour en confirmation */}
          <Button
            variant="secondary" size="sm" loading={actionLoading}
            onClick={() => doAction('go_back_to_confirmation')}
          >
            <RotateCcw size={13} /> Retour
          </Button>
        </div>
      )
    }

    if (status === 'en_dispatch') {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Expédier */}
          <Button
            variant="primary" size="sm" loading={actionLoading}
            onClick={() => doAction('ship')}
          >
            <Send size={13} /> Expédier
          </Button>

          {/* Toggle sync */}
          <Button
            variant="secondary" size="sm" loading={actionLoading}
            onClick={() => doAction('toggle_sync')}
          >
            {o.sync_enabled
              ? <><WifiOff size={13} /> Désactiver sync</>
              : <><Wifi size={13} /> Activer sync</>
            }
          </Button>

          {/* Retour en préparation */}
          <Button
            variant="secondary" size="sm" loading={actionLoading}
            onClick={() => doAction('go_back_to_preparation')}
          >
            <RotateCcw size={13} /> Retour
          </Button>
        </div>
      )
    }

    if (status === 'en_livraison') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Main action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Valider livraison */}
            <Button
              variant="primary" size="sm" loading={actionLoading}
              onClick={() => doAction('deliver')}
            >
              <PackageCheck size={13} /> Valider livraison
            </Button>

            {/* Demander retour */}
            <Button
              variant="danger" size="sm" loading={actionLoading}
              onClick={() => doAction('request_return')}
            >
              <RotateCcw size={13} /> Demander retour
            </Button>

            {/* Modifier statut livraison */}
            <div ref={delivStatusRef} style={{ position: 'relative' }}>
              <Button
                variant="secondary" size="sm" loading={actionLoading}
                onClick={() => setShowDelivStatus(v => !v)}
              >
                <Tag size={13} /> Statut livraison <ChevronDown size={11} />
              </Button>
              {showDelivStatus && (
                <FloatingMenu>
                  {deliveryStatuses.length === 0
                    ? <div style={{ padding: '10px 14px', fontSize: 12.5, color: colors.textLt }}>Aucun statut</div>
                    : deliveryStatuses.map(s => (
                      <MenuBtn key={s.id} onClick={() => doAction('set_delivery_status', s.slug)}>
                        {s.name}
                      </MenuBtn>
                    ))
                  }
                </FloatingMenu>
              )}
            </div>
          </div>

          {/* Carrier fee inline edit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: colors.textMd, fontFamily: fonts.sans }}>Frais livreur :</span>
            {carrierFeeEditing ? (
              <>
                <input
                  type="number"
                  min={0}
                  value={carrierFeeInput}
                  onChange={e => setCarrierFeeInput(e.target.value)}
                  autoFocus
                  style={{
                    width: 84, padding: '4px 7px', fontSize: 12,
                    border: `1px solid ${colors.border}`, borderRadius: 4,
                    fontFamily: fonts.sans, color: colors.text, outline: 'none',
                  }}
                />
                <Button
                  size="sm" loading={actionLoading}
                  onClick={async () => {
                    await doAction('set_carrier_fee', carrierFeeInput)
                    setCarrierFeeEditing(false)
                  }}
                >
                  Sauvegarder
                </Button>
                <button
                  onClick={() => setCarrierFeeEditing(false)}
                  style={{
                    fontSize: 12, color: colors.textLt, border: 'none',
                    background: 'none', cursor: 'pointer', padding: 0,
                    fontFamily: fonts.sans,
                  }}
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.text, fontFamily: fonts.sans }}>
                  {fmtAmt(o.carrier_fee ?? 0)}
                </span>
                <button
                  onClick={() => { setCarrierFeeInput(String(o.carrier_fee ?? 0)); setCarrierFeeEditing(true) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    fontSize: 11, color: colors.primary, border: 'none',
                    background: 'none', cursor: 'pointer', padding: 0,
                    fontFamily: fonts.sans,
                  }}
                >
                  <Pencil size={10} /> Modifier
                </button>
              </>
            )}
          </div>
        </div>
      )
    }

    if (status === 'livree') {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="primary" size="sm" loading={actionLoading}
            onClick={() => doReceipt('encaissement')}
          >
            <FileText size={13} /> Préparer bon
          </Button>

          <Button
            variant="secondary" size="sm" loading={actionLoading}
            onClick={() => doAction('go_back_to_livraison')}
          >
            <RotateCcw size={13} /> Retour en livraison
          </Button>
        </div>
      )
    }

    if (status === 'en_retour') {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="primary" size="sm" loading={actionLoading}
            onClick={() => doAction('validate_return')}
          >
            <PackageCheck size={13} /> Valider retour
          </Button>

          <Button
            variant="secondary" size="sm" loading={actionLoading}
            onClick={() => doReceipt('retour')}
          >
            <FileText size={13} /> Préparer bon retour
          </Button>

          <Button
            variant="secondary" size="sm" loading={actionLoading}
            onClick={() => doAction('go_back_to_livraison')}
          >
            <RotateCcw size={13} /> Retour en livraison
          </Button>
        </div>
      )
    }

    // Soft-deleted (corbeille) — check before status so it overrides
    if (o.deleted_at) {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="primary" size="sm" loading={actionLoading}
            onClick={() => doAction('undo_delete')}
          >
            <RotateCcw size={13} /> Annuler la suppression
          </Button>
          <Button
            variant="danger" size="sm" loading={actionLoading}
            onClick={doHardDelete}
          >
            <XCircle size={13} /> Supprimer définitivement
          </Button>
        </div>
      )
    }

    if (status === 'annulee') {
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button
            variant="primary" size="sm" loading={actionLoading}
            onClick={() => doAction('restore')}
          >
            <RotateCcw size={13} /> Restaurer
          </Button>
          <Button
            variant="danger" size="sm" loading={actionLoading}
            onClick={doHardDelete}
          >
            <XCircle size={13} /> Supprimer définitivement
          </Button>
        </div>
      )
    }

    // Other read-only statuses (encaissee, retournee, etc.)
    return (
      <span style={{ fontSize: 12, color: colors.textLt, fontFamily: fonts.sans }}>
        Commande archivée — aucune action disponible.
      </span>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.22)', zIndex: 199,
          transition: 'opacity 0.2s',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 420, background: '#fff', zIndex: 200,
        boxShadow: '-4px 0 20px rgba(0,0,0,0.12)',
        display: 'flex', flexDirection: 'column',
        fontFamily: fonts.sans,
        transform: mounted ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.22s cubic-bezier(.4,0,.2,1)',
      }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0, background: '#fff',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>
                {o?.reference ?? '—'}
              </span>
              {o && <StatusPill slug={o.tracking_status} map={TRACKING_LABELS} />}
              {o?.confirmation_status && <StatusPill slug={o.confirmation_status} map={CONF_LABELS} />}
            </div>
            {o && (
              <span style={{ fontSize: 11, color: colors.textLt }}>
                {fmtDate(o.created_at)} · {SOURCE_LABELS[o.source_type] ?? o.source_type}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: colors.textLt, padding: 6, borderRadius: 4, display: 'flex',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f0f0f0'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'none'}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {loading && !o ? (
            <>
              <Pulse /><Pulse /><Pulse />
            </>
          ) : !o ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textLt, fontSize: 13 }}>
              <AlertCircle size={24} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
              Commande introuvable
            </div>
          ) : (
            <>
              {/* ── 1. Client ────────────────────────────────────────────── */}
              <SectionCard title="Client" icon={<User size={12} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <InfoRow icon={<User size={12} />}  label="Nom complet" value={o.client?.full_name ?? null} />
                  <InfoRow icon={<Phone size={12} />} label="Téléphone"   value={o.client?.phone ?? o.phone} />
                  {o.client?.phone2 && (
                    <InfoRow icon={<Phone size={12} />} label="Téléphone 2" value={o.client.phone2} />
                  )}
                  {o.client?.email && (
                    <InfoRow icon={<Mail size={12} />} label="Email" value={o.client.email} />
                  )}
                  {(o.wilaya_name || o.commune_name) && (
                    <InfoRow
                      icon={<MapPin size={12} />}
                      label="Localisation"
                      value={[o.wilaya_name, o.commune_name].filter(Boolean).join(' › ')}
                    />
                  )}
                  {(o.address || o.client?.address) && (
                    <InfoRow icon={<MapPin size={12} />} label="Adresse" value={o.address ?? o.client?.address ?? null} />
                  )}
                  {o.referrer && (
                    <InfoRow icon={<Activity size={12} />} label="Référent" value={o.referrer} />
                  )}
                </div>
              </SectionCard>

              {/* ── 2. Articles ──────────────────────────────────────────── */}
              <SectionCard title="Articles" icon={<Package size={12} />}>
                {o.items.length === 0 ? (
                  <span style={{ fontSize: 12.5, color: colors.textLt }}>Aucun article</span>
                ) : (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                          {['Produit', 'Qté', 'Prix', 'Total'].map((h, i) => (
                            <th key={h} style={{
                              textAlign: i === 0 ? 'left' : 'right', padding: '4px 0',
                              fontSize: 10.5, color: colors.textLt, fontWeight: 700,
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {o.items.map(item => (
                          <tr key={item.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <td style={{ padding: '7px 0', verticalAlign: 'middle' }}>
                              <div style={{ fontSize: 12.5, fontWeight: 500, color: colors.text }}>{item.product_name}</div>
                              <div style={{ fontSize: 10.5, color: colors.textLt }}>{item.sku}</div>
                            </td>
                            <td style={{ textAlign: 'right', padding: '7px 0', fontSize: 12.5, color: colors.textMd }}>
                              ×{item.quantity}
                            </td>
                            <td style={{ textAlign: 'right', padding: '7px 0', fontSize: 12.5, color: colors.textMd }}>
                              {fmtAmt(item.unit_price)}
                            </td>
                            <td style={{ textAlign: 'right', padding: '7px 0', fontSize: 12.5, fontWeight: 600, color: colors.text }}>
                              {fmtAmt(item.line_total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{
                      display: 'flex', justifyContent: 'flex-end', marginTop: 6,
                      fontSize: 12.5, color: colors.textMd,
                    }}>
                      Sous-total :&nbsp;<strong style={{ color: colors.text }}>{fmtAmt(o.subtotal)}</strong>
                    </div>
                  </>
                )}
              </SectionCard>

              {/* ── 3. Livraison ────────────────────────────────────────── */}
              <SectionCard title="Livraison" icon={<Truck size={12} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <InfoRow
                    icon={<Truck size={12} />}
                    label="Méthode"
                    value={o.delivery_method === 'stopdesk' ? 'Stop Desk' : 'À domicile'}
                  />
                  {o.carrier_name && (
                    <InfoRow icon={<Truck size={12} />} label="Livreur" value={o.carrier_name} />
                  )}
                  {o.confirmer_name && (
                    <InfoRow icon={<UserCheck size={12} />} label="Confirmateur" value={o.confirmer_name} />
                  )}
                </div>
              </SectionCard>

              {/* ── 4. Totaux ────────────────────────────────────────────── */}
              <SectionCard title="Totaux" icon={<CreditCard size={12} />}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <TotalRow label="Sous-total"         value={fmtAmt(o.subtotal)} />
                  <TotalRow label="Frais de livraison" value={fmtAmt(o.delivery_fee)} />
                  {(o.carrier_fee ?? 0) > 0 && (
                    <TotalRow label="Frais livreur" value={fmtAmt(o.carrier_fee)} />
                  )}
                  {(o.discount ?? 0) > 0 && (
                    <TotalRow label="Remise" value={`– ${fmtAmt(o.discount)}`} />
                  )}
                  <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 7 }}>
                    <TotalRow label="Total" value={fmtAmt(o.total)} bold primary />
                  </div>
                </div>
              </SectionCard>

              {/* ── Remarque ─────────────────────────────────────────────── */}
              {o.remark && (
                <div style={{
                  background: '#fffbf0', border: '1px solid #ffe0a3',
                  borderRadius: 6, padding: '10px 12px',
                  fontSize: 12.5, color: '#6d4c00', fontStyle: 'italic',
                }}>
                  {o.remark}
                </div>
              )}

              {/* ── 5. Historique ────────────────────────────────────────── */}
              <SectionCard title="Historique" icon={<Clock size={12} />}>
                {logsLoading ? (
                  <Pulse />
                ) : logs.length === 0 ? (
                  <span style={{ fontSize: 12.5, color: colors.textLt }}>Aucun historique</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {logs.map((log, idx) => (
                      <div key={log.id} style={{
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        paddingBottom: idx < logs.length - 1 ? 10 : 0,
                        borderBottom: idx < logs.length - 1 ? `1px solid ${colors.border}` : 'none',
                      }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: colors.primaryLt, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Activity size={12} style={{ color: colors.primary }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12.5, color: colors.text, fontWeight: 500 }}>
                            {LOG_LABELS[log.action] ?? log.action}
                          </div>
                          {log.action === 'noest_push' && typeof log.new_values?.noest_tracking === 'string' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <span style={{
                                fontSize: 11, fontFamily: 'monospace',
                                background: '#E3F2FD', color: '#1565C0',
                                padding: '1px 6px', borderRadius: 3,
                              }}>
                                {log.new_values.noest_tracking}
                              </span>
                              <button
                                onClick={() => {
                                  if (!orderId) return
                                  fetch(`/api/orders/${orderId}/noest/label`, { headers: authHeader() })
                                    .then(r => r.blob())
                                    .then(blob => {
                                      const url = URL.createObjectURL(blob)
                                      const a   = document.createElement('a')
                                      a.href     = url
                                      a.download = `etiquette-${log.new_values?.noest_tracking as string ?? 'noest'}.pdf`
                                      a.click()
                                      URL.revokeObjectURL(url)
                                    })
                                    .catch(() => {})
                                }}
                                style={{
                                  fontSize: 10.5, color: '#1565C0', background: 'none',
                                  border: 'none', cursor: 'pointer', padding: 0,
                                  textDecoration: 'underline',
                                }}
                              >
                                Télécharger étiquette
                              </button>
                            </div>
                          )}
                          {log.action === 'noest_push_failed' && (
                            <div style={{ marginTop: 4 }}>
                              <NoestErrorBox
                                rawError={log.new_values?.error as string | undefined}
                                orderId={orderId}
                                retrying={noestRetrying}
                                retryMsg={noestRetryMsg}
                                onRetry={async () => {
                                  if (!orderId) return
                                  setNoestRetrying(true)
                                  setNoestRetryMsg('')
                                  try {
                                    const res  = await fetch(`/api/orders/${orderId}/noest`, {
                                      method:  'POST',
                                      headers: { 'Content-Type': 'application/json', ...authHeader() },
                                      body:    JSON.stringify({ action: 'push' }),
                                    })
                                    const data = await res.json() as { success?: boolean; noest_tracking?: string; error?: unknown }
                                    if (res.ok && data.success) {
                                      setNoestRetryMsg(`✓ Envoyée — ${data.noest_tracking}`)
                                      // Reload logs
                                      const lr = await fetch(`/api/orders/${orderId}/logs`, { headers: authHeader() })
                                      if (lr.ok) setLogs(await lr.json())
                                    } else {
                                      const parsed = typeof data.error === 'string'
                                        ? tryParseNoestError(data.error)
                                        : JSON.stringify(data.error)
                                      setNoestRetryMsg(`Échec : ${parsed}`)
                                    }
                                  } catch {
                                    setNoestRetryMsg('Erreur réseau')
                                  } finally {
                                    setNoestRetrying(false)
                                  }
                                }}
                              />
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: colors.textLt, marginTop: 1 }}>
                            {log.user_name && `${log.user_name} · `}
                            {log.created_at ? fmtDateTime(log.created_at) : '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>

        {/* ── Footer: action buttons ───────────────────────────────────────── */}
        <div style={{
          borderTop: `1px solid ${colors.border}`,
          padding: '12px 14px', flexShrink: 0, background: '#fff',
        }}>
          {actionError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: colors.red, marginBottom: 8,
            }}>
              <AlertCircle size={12} /> {actionError}
            </div>
          )}
          {renderActions()}
        </div>
      </div>
    </>
  )
}

// ── Floating menu helpers ──────────────────────────────────────────────────────

function FloatingMenu({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 50,
      background: '#fff', border: `1px solid ${colors.border}`, borderRadius: 6,
      boxShadow: '0 -4px 16px rgba(0,0,0,0.1)', minWidth: 180, overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

function MenuBtn({ children, onClick, color }: { children: ReactNode; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '8px 14px', fontSize: 12.5, fontFamily: fonts.sans,
        border: 'none', background: 'transparent', cursor: 'pointer',
        color: color ?? colors.text,
      }}
      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f5'}
      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
    >
      {children}
    </button>
  )
}
