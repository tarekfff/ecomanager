'use client'
import { useEffect, useRef, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Globe, MessageSquare, Bell, BookOpen, LogOut, ChevronDown, ShoppingBag, Store } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import { useBoutique } from '@/contexts/BoutiqueContext'
import { colors, fonts } from '@/lib/tokens'

interface BoutiqueOption { id: string; name: string; prefix: string }

const ITEM_ROUTES: Record<string, string> = {
  'Nouvelle commande':   '/dashboard/orders/new',
  'Liste des clients':   '/dashboard/clients',
  'Import clients':      '/dashboard/clients/import',
  'Liste des produits':  '/dashboard/products',
  'Ajouter un produit':  '/dashboard/products/new',
  'Import en masse':     '/dashboard/products/import',
  'Options & attributs': '/dashboard/products/options',
}

function getActiveItem(pathname: string): string {
  if (pathname.startsWith('/dashboard/orders/new'))        return 'Nouvelle commande'
  if (pathname === '/dashboard/clients/import')            return 'Import clients'
  if (pathname.startsWith('/dashboard/clients'))           return 'Liste des clients'
  if (pathname.startsWith('/dashboard/products/new'))      return 'Ajouter un produit'
  if (pathname.startsWith('/dashboard/products/options'))  return 'Options & attributs'
  if (pathname.startsWith('/dashboard/products/import'))   return 'Import en masse'
  if (pathname.startsWith('/dashboard/products'))          return 'Liste des produits'
  return ''
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { boutiqueId, boutiqueName, setBoutique } = useBoutique()

  const [ready,            setReady]            = useState(false)
  const [boutiques,        setBoutiques]        = useState<BoutiqueOption[]>([])
  const [showBoutiqueMenu, setShowBoutiqueMenu] = useState(false)
  const boutiqueMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.replace('/login'); return }
    setReady(true)

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
  }, [router, setBoutique])

  useEffect(() => {
    if (!showBoutiqueMenu) return
    function onOutside(e: MouseEvent) {
      if (boutiqueMenuRef.current && !boutiqueMenuRef.current.contains(e.target as Node)) {
        setShowBoutiqueMenu(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showBoutiqueMenu])

  if (!ready) return null

  const activeItem  = getActiveItem(pathname)
  const displayName = boutiqueName || boutiques[0]?.name || '…'

  function handleSidebarClick(label: string) {
    const route = ITEM_ROUTES[label]
    if (route) router.push(route)
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('boutiqueId')
    localStorage.removeItem('boutiqueName')
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── Topbar ── */}
      <div style={{
        height: 48,
        background: `linear-gradient(90deg, ${colors.primary} 0%, #A03A80 100%)`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 10px rgba(191,76,152,0.35)',
        fontFamily: fonts.sans,
      }}>

        {/* Brand logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginRight: 20, flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28,
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.25)',
          }}>
            <ShoppingBag size={15} color="#fff" strokeWidth={1.8} />
          </div>
          <span style={{
            fontSize: 17, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.5px', lineHeight: 1,
          }}>
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
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.14)'}
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
              zIndex: 200, minWidth: 200,
              overflow: 'hidden',
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
                    cursor: 'pointer',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (b.id !== boutiqueId) (e.currentTarget as HTMLButtonElement).style.background = '#FAFAFA' }}
                  onMouseLeave={e => { if (b.id !== boutiqueId) (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                >
                  <Store size={13} strokeWidth={1.8} style={{ color: b.id === boutiqueId ? colors.primary : '#ccc', flexShrink: 0 }} />
                  {b.name}
                  {b.prefix && <span style={{ color: '#aaa', fontSize: 11, marginLeft: 'auto' }}>{b.prefix}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[
            { icon: Globe,          label: 'Langue' },
            { icon: MessageSquare,  label: 'Feedback' },
            { icon: Bell,           label: 'Mises à jour' },
            { icon: BookOpen,       label: 'Tutoriels' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              title={label}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.0)',
                border: 'none', borderRadius: 6,
                padding: '5px 8px', cursor: 'pointer',
                fontSize: 12, color: 'rgba(255,255,255,0.88)',
                fontFamily: fonts.sans,
                transition: 'background .15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.0)'}
            >
              <Icon size={14} strokeWidth={1.8} />
              <span style={{ display: label === 'Langue' ? 'none' : 'inline' }}>{label}</span>
            </button>
          ))}

          {/* User chip */}
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 20, padding: '4px 12px 4px 6px',
              cursor: 'pointer', fontFamily: fonts.sans,
              transition: 'background .15s',
              marginLeft: 4,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.26)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)'}
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

      {/* ── Body: sidebar + page content ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Sidebar activeItem={activeItem} onItemClick={handleSidebarClick} />

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: colors.bg,
        }}>
          {children}
        </div>
      </div>

    </div>
  )
}
