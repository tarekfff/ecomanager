'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Globe, MessageSquare, Bell, BookOpen, LogOut,
  ChevronDown, ShoppingBag, Store, ShoppingCart,
} from 'lucide-react'
import { useBoutique } from '@/contexts/BoutiqueContext'
import { colors, fonts } from '@/lib/tokens'
import { getStoredToken, clearAuth } from '@/lib/client-auth'

interface BoutiqueOption { id: string; name: string; prefix: string }

const PIPELINE = [
  { label: 'En confirmation', path: '/dashboard/orders/en-confirmation', dot: '#4472C4' },
  { label: 'En préparation',  path: '/dashboard/orders/en-preparation',  dot: '#9966CC' },
  { label: 'En dispatch',     path: '/dashboard/orders/en-dispatch',      dot: '#E6B800' },
  { label: 'En livraison',    path: '/dashboard/orders/en-livraison',     dot: '#888888' },
  { label: 'Livrées',         path: '/dashboard/orders/livrees',          dot: '#00B0A0' },
  { label: 'En retour',       path: '/dashboard/orders/en-retour',        dot: '#E84B6A' },
]

export default function Topbar() {
  const router   = useRouter()
  const pathname = usePathname()
  const { boutiqueId, boutiqueName, setBoutique } = useBoutique()

  const [boutiques,        setBoutiques]        = useState<BoutiqueOption[]>([])
  const [showBoutiqueMenu, setShowBoutiqueMenu] = useState(false)
  const [showNavMenu,      setShowNavMenu]      = useState(false)
  const boutiqueMenuRef = useRef<HTMLDivElement>(null)
  const navMenuRef      = useRef<HTMLDivElement>(null)

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
  }, [setBoutique])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (boutiqueMenuRef.current && !boutiqueMenuRef.current.contains(e.target as Node))
        setShowBoutiqueMenu(false)
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node))
        setShowNavMenu(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function handleLogout() {
    clearAuth()
    router.push('/login')
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
          { icon: Bell,          label: 'Mises à jour' },
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

        {/* User chip / logout */}
        <button
          onClick={handleLogout}
          title="Se déconnecter"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 20, padding: '4px 12px 4px 6px',
            cursor: 'pointer', fontFamily: fonts.sans,
            transition: 'background .15s', marginLeft: 4,
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
            A
          </div>
          <span style={{ fontSize: 12, color: '#fff', fontWeight: 500 }}>Admin</span>
          <LogOut size={11} style={{ color: 'rgba(255,255,255,0.7)' }} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
