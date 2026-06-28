'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Globe, MessageSquare, Bell, BookOpen, LogOut,
  ChevronDown, ShoppingBag, Store, ShoppingCart,
  User as UserIcon, CheckCheck, Package, Truck, RotateCcw, Menu,
} from 'lucide-react'
import { useBoutique } from '@/contexts/BoutiqueContext'
import { useUI } from '@/contexts/UIContext'
import { colors, fonts } from '@/lib/tokens'
import { getStoredToken, clearAuth } from '@/lib/client-auth'

interface BoutiqueOption { id: string; name: string; prefix: string }

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  is_read: boolean
  created_at: string
}

const PIPELINE = [
  { label: 'En confirmation', path: '/dashboard/orders/en-confirmation', dot: '#4472C4' },
  { label: 'En préparation',  path: '/dashboard/orders/en-preparation',  dot: '#9966CC' },
  { label: 'En dispatch',     path: '/dashboard/orders/en-dispatch',      dot: '#E6B800' },
  { label: 'En livraison',    path: '/dashboard/orders/en-livraison',     dot: '#888888' },
  { label: 'Livrées',         path: '/dashboard/orders/livrees',          dot: '#00B0A0' },
  { label: 'En retour',       path: '/dashboard/orders/en-retour',        dot: '#E84B6A' },
]

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return "à l'instant"
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  return `il y a ${j} j`
}

function notifIcon(type: string) {
  if (type === 'stock_alert')    return <Package size={15} color={colors.orange} strokeWidth={1.9} />
  if (type === 'order_delivered') return <Truck size={15} color={colors.green} strokeWidth={1.9} />
  if (type === 'order_returned') return <RotateCcw size={15} color={colors.red} strokeWidth={1.9} />
  return <Bell size={15} color={colors.primary} strokeWidth={1.9} />
}

export default function Topbar() {
  const router   = useRouter()
  const pathname = usePathname()
  const { boutiqueId, boutiqueName, setBoutique } = useBoutique()
  const { toggleSidebar } = useUI()

  const [boutiques,        setBoutiques]        = useState<BoutiqueOption[]>([])
  const [showBoutiqueMenu, setShowBoutiqueMenu] = useState(false)
  const [showNavMenu,      setShowNavMenu]      = useState(false)
  const [showNotifMenu,    setShowNotifMenu]    = useState(false)
  const [showUserMenu,     setShowUserMenu]     = useState(false)

  const [userName,      setUserName]      = useState('Admin')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread,        setUnread]        = useState(0)

  const boutiqueMenuRef = useRef<HTMLDivElement>(null)
  const navMenuRef      = useRef<HTMLDivElement>(null)
  const notifMenuRef    = useRef<HTMLDivElement>(null)
  const userMenuRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = getStoredToken()
    if (!token) return
    fetch('/api/boutiques', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: BoutiqueOption[]) => {
        if (!Array.isArray(data)) return
        setBoutiques(data)
        if (data.length > 0 && !localStorage.getItem('boutiqueId')) {
          setBoutique(data[0].id, data[0].name)
        }
      })
      .catch(() => {})

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { user?: { name?: string } }) => { if (d.user?.name) setUserName(d.user.name) })
      .catch(() => {})
  }, [setBoutique])

  // ── Notifications: fetch now + poll every 30s ──────────────────────────────
  const fetchNotifs = useCallback(() => {
    const token = getStoredToken()
    if (!token) return
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { items?: Notification[]; unread?: number }) => {
        setNotifications(d.items ?? [])
        setUnread(d.unread ?? 0)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, 30_000)
    return () => clearInterval(id)
  }, [fetchNotifs])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      const t = e.target as Node
      if (boutiqueMenuRef.current && !boutiqueMenuRef.current.contains(t)) setShowBoutiqueMenu(false)
      if (navMenuRef.current      && !navMenuRef.current.contains(t))      setShowNavMenu(false)
      if (notifMenuRef.current    && !notifMenuRef.current.contains(t))    setShowNotifMenu(false)
      if (userMenuRef.current     && !userMenuRef.current.contains(t))     setShowUserMenu(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function handleLogout() {
    clearAuth()
    router.push('/login')
  }

  function markRead(id: string) {
    const token = getStoredToken()
    if (!token) return
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnread(prev => Math.max(0, prev - 1))
    fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    }).catch(() => {})
  }

  function markAllRead() {
    const token = getStoredToken()
    if (!token) return
    setNotifications([])
    setUnread(0)
    fetch('/api/notifications/bulk', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    }).catch(() => {})
  }

  const displayName = boutiqueName || boutiques[0]?.name || '…'

  return (
    <div style={{
      height: 46,
      background: `linear-gradient(90deg, ${colors.primary} 0%, #A03A80 100%)`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      flexShrink: 0,
      zIndex: 100,
      boxShadow: '0 2px 10px rgba(191,76,152,0.35)',
      fontFamily: fonts.sans,
    }}>

      {/* Hamburger — only visible < 1200px (via .hamburger-btn CSS) */}
      <button
        className="hamburger-btn"
        onClick={toggleSidebar}
        title="Menu"
        aria-label="Ouvrir le menu"
        style={{
          alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, marginRight: 8, flexShrink: 0,
          background: 'rgba(255,255,255,0.14)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 6, color: '#fff', cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.24)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
      >
        <Menu size={17} strokeWidth={2} />
      </button>

      {/* Brand logo */}
      <div
        onClick={() => router.push('/dashboard')}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 20, flexShrink: 0, cursor: 'pointer' }}
      >
        <div style={{
          width: 28, height: 28,
          background: 'rgba(255,255,255,0.2)',
          borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(255,255,255,0.25)',
        }}>
          <ShoppingBag size={15} color="#fff" strokeWidth={1.8} />
        </div>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1 }}>
          chic<span style={{ color: 'rgba(255,220,245,0.85)' }}>N</span>
        </span>
      </div>

      {/* Boutique selector */}
      <div ref={boutiqueMenuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowBoutiqueMenu(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6, padding: '5px 10px', fontSize: 12,
            color: '#fff', cursor: 'pointer', fontFamily: fonts.sans,
            transition: 'background .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
        >
          <Store size={12} strokeWidth={1.8} />
          <span>{displayName}</span>
          <ChevronDown size={11} />
        </button>

        {showBoutiqueMenu && boutiques.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            background: '#fff', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 200, minWidth: 200, overflow: 'hidden',
            border: '1px solid #E2D8E2',
          }}>
            {boutiques.map(b => (
              <button
                key={b.id}
                onClick={() => { setBoutique(b.id, b.name); setShowBoutiqueMenu(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left',
                  padding: '9px 14px', fontSize: 13, fontFamily: fonts.sans,
                  border: 'none',
                  background: b.id === boutiqueId ? colors.primaryLt : '#fff',
                  color:      b.id === boutiqueId ? colors.primary    : colors.text,
                  fontWeight: b.id === boutiqueId ? 600 : 400,
                  cursor: 'pointer', transition: 'background .1s',
                }}
                onMouseEnter={e => { if (b.id !== boutiqueId) e.currentTarget.style.background = '#FAFAFA' }}
                onMouseLeave={e => { if (b.id !== boutiqueId) e.currentTarget.style.background = '#fff' }}
              >
                <Store size={13} strokeWidth={1.8} style={{ color: b.id === boutiqueId ? colors.primary : '#ccc', flexShrink: 0 }} />
                {b.name}
                {b.prefix && <span style={{ color: '#aaa', fontSize: 11, marginLeft: 'auto' }}>{b.prefix}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Commandes quick-nav */}
      <div ref={navMenuRef} style={{ position: 'relative', marginLeft: 12 }}>
        <button
          onClick={() => setShowNavMenu(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: showNavMenu ? 'rgba(255,255,255,0.22)' : 'transparent',
            border: 'none', borderRadius: 6,
            padding: '5px 10px', cursor: 'pointer',
            fontSize: 12.5, color: 'rgba(255,255,255,0.92)',
            fontFamily: fonts.sans, fontWeight: 500,
            transition: 'background .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
          onMouseLeave={e => (e.currentTarget.style.background = showNavMenu ? 'rgba(255,255,255,0.22)' : 'transparent')}
        >
          <ShoppingCart size={13} strokeWidth={1.8} />
          Commandes
          <ChevronDown size={11} style={{ opacity: 0.7 }} />
        </button>

        {showNavMenu && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300,
            background: '#fff', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            border: '1px solid #E2D8E2', minWidth: 200, overflow: 'hidden',
          }}>
            <button
              onClick={() => { router.push('/dashboard/orders/new'); setShowNavMenu(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', textAlign: 'left',
                padding: '9px 14px', fontSize: 13, fontFamily: fonts.sans,
                border: 'none', background: 'transparent', cursor: 'pointer',
                color: colors.primary, fontWeight: 600,
                borderBottom: '1px solid #f0e8f0',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = colors.primaryLt)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              + Nouvelle commande
            </button>

            {PIPELINE.map(({ label, path, dot }) => {
              const isActive = pathname.startsWith(path)
              return (
                <button
                  key={path}
                  onClick={() => { router.push(path); setShowNavMenu(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', textAlign: 'left',
                    padding: '8px 14px', fontSize: 13, fontFamily: fonts.sans,
                    border: 'none',
                    background: isActive ? colors.primaryLt : 'transparent',
                    color: isActive ? colors.primary : colors.text,
                    fontWeight: isActive ? 600 : 400, cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#fafafa' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                  {label}
                  {isActive && <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: colors.primary }} />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {([
          { icon: Globe,         label: 'Langue' },
          { icon: MessageSquare, label: 'Feedback' },
          { icon: BookOpen,      label: 'Tutoriels' },
        ] as const).map(({ icon: Icon, label }) => (
          <button
            key={label}
            title={label}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'transparent',
              border: 'none', borderRadius: 6,
              padding: '5px 8px', cursor: 'pointer',
              fontSize: 12, color: 'rgba(255,255,255,0.88)',
              fontFamily: fonts.sans, transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Icon size={14} strokeWidth={1.8} />
            <span style={{ display: label === 'Langue' ? 'none' : 'inline' }}>{label}</span>
          </button>
        ))}

        {/* Notifications bell */}
        <div ref={notifMenuRef} style={{ position: 'relative' }}>
          <button
            title="Notifications"
            onClick={() => { setShowNotifMenu(v => !v); if (!showNotifMenu) fetchNotifs() }}
            style={{
              display: 'flex', alignItems: 'center', position: 'relative',
              background: showNotifMenu ? 'rgba(255,255,255,0.22)' : 'transparent',
              border: 'none', borderRadius: 6,
              padding: '5px 8px', cursor: 'pointer',
              color: 'rgba(255,255,255,0.88)', transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = showNotifMenu ? 'rgba(255,255,255,0.22)' : 'transparent')}
          >
            <Bell size={15} strokeWidth={1.8} />
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: 1, right: 1,
                minWidth: 15, height: 15, padding: '0 3px',
                background: '#E84B6A', color: '#fff',
                borderRadius: 8, fontSize: 9.5, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid #B0407A', lineHeight: 1,
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300,
              background: '#fff', borderRadius: 10,
              boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
              border: '1px solid #E2D8E2', width: 340, overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '11px 14px', borderBottom: '1px solid #f0e8f0',
              }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: colors.text }}>
                  Notifications
                </span>
                {notifications.length > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 11.5, color: colors.primary, fontWeight: 600,
                      fontFamily: fonts.sans, padding: 0,
                    }}
                  >
                    <CheckCheck size={13} strokeWidth={2} />
                    Tout marquer comme lu
                  </button>
                )}
              </div>

              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '28px 14px', textAlign: 'center', color: colors.textLt, fontSize: 12.5 }}>
                    Aucune notification non lue
                  </div>
                ) : notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    title="Marquer comme lu"
                    style={{
                      display: 'flex', gap: 10, width: '100%', textAlign: 'left',
                      padding: '11px 14px', border: 'none',
                      borderBottom: '1px solid #f5eef5',
                      background: '#FCF7FB', cursor: 'pointer', fontFamily: fonts.sans,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = colors.primaryLt)}
                    onMouseLeave={e => (e.currentTarget.style.background = '#FCF7FB')}
                  >
                    <span style={{ flexShrink: 0, marginTop: 1 }}>{notifIcon(n.type)}</span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: colors.text }}>{n.title}</span>
                      {n.body && <span style={{ fontSize: 12, color: colors.textMd, lineHeight: 1.35 }}>{n.body}</span>}
                      <span style={{ fontSize: 10.5, color: colors.textLt }}>{timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User chip + menu */}
        <div ref={userMenuRef} style={{ position: 'relative', marginLeft: 4 }}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            title="Mon compte"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 20, padding: '4px 10px 4px 6px',
              cursor: 'pointer', fontFamily: fonts.sans,
              transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.26)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
          >
            <div style={{
              width: 22, height: 22,
              background: 'rgba(255,255,255,0.9)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: colors.primary,
            }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: '#fff', fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userName}
            </span>
            <ChevronDown size={11} style={{ color: 'rgba(255,255,255,0.75)' }} />
          </button>

          {showUserMenu && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 300,
              background: '#fff', borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              border: '1px solid #E2D8E2', minWidth: 180, overflow: 'hidden',
            }}>
              <button
                onClick={() => { router.push('/dashboard/profile'); setShowUserMenu(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  width: '100%', textAlign: 'left',
                  padding: '10px 14px', fontSize: 13, fontFamily: fonts.sans,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: colors.text, borderBottom: '1px solid #f0e8f0',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <UserIcon size={14} strokeWidth={1.9} style={{ color: colors.primary }} />
                Mon profil
              </button>
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  width: '100%', textAlign: 'left',
                  padding: '10px 14px', fontSize: 13, fontFamily: fonts.sans,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: colors.red,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fdf0f2')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <LogOut size={14} strokeWidth={1.9} />
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
