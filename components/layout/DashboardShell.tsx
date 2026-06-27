'use client'
import { useEffect, useRef, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Globe, MessageSquare, Bell, BookOpen, User, LogOut, ChevronDown } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import { useBoutique } from '@/contexts/BoutiqueContext'
import { colors, fonts } from '@/lib/tokens'

interface BoutiqueOption { id: string; name: string; prefix: string }

// Map sidebar item labels → routes (extend as pages are added)
const ITEM_ROUTES: Record<string, string> = {
  'Liste des clients':     '/dashboard/clients',
  'Import clients':        '/dashboard/clients/import',
  'Liste des produits':    '/dashboard/products',
  'Ajouter un produit':    '/dashboard/products/new',
  'Import en masse':       '/dashboard/products/import',
  'Options & attributs':   '/dashboard/products/options',
}

function getActiveItem(pathname: string): string {
  if (pathname === '/dashboard/clients/import')              return 'Import clients'
  if (pathname.startsWith('/dashboard/clients'))             return 'Liste des clients'
  if (pathname.startsWith('/dashboard/products/new'))        return 'Ajouter un produit'
  if (pathname.startsWith('/dashboard/products/options'))    return 'Options & attributs'
  if (pathname.startsWith('/dashboard/products/import'))     return 'Import en masse'
  if (pathname.startsWith('/dashboard/products'))            return 'Liste des produits'
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

  // Auth check + boutique fetch (once on mount)
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

  // Close boutique dropdown on outside click
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
    <div className="dash-wrap">

      {/* ── Topbar ────────────────────────────────────────────────────────── */}
      <div className="topbar">
        <div className="topbar-logo">
          <span className="e-bracket" />
          COMANAGER
        </div>

        {/* Boutique selector */}
        <div ref={boutiqueMenuRef} style={{ position: 'relative', marginLeft: 12 }}>
          <button
            onClick={() => setShowBoutiqueMenu(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              borderRadius: 4, padding: '4px 10px', fontSize: 12,
              color: '#fff', cursor: 'pointer', fontFamily: fonts.sans,
            }}
          >
            {displayName}
            <ChevronDown size={12} />
          </button>

          {showBoutiqueMenu && boutiques.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              background: '#fff', borderRadius: 4,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              zIndex: 200, minWidth: 180, overflow: 'hidden',
            }}>
              {boutiques.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setBoutique(b.id, b.name); setShowBoutiqueMenu(false) }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 14px', fontSize: 12.5, fontFamily: fonts.sans,
                    border: 'none',
                    background: b.id === boutiqueId ? colors.primaryLt : '#fff',
                    color:      b.id === boutiqueId ? colors.primary    : colors.text,
                    fontWeight: b.id === boutiqueId ? 600 : 400,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => { if (b.id !== boutiqueId) (e.currentTarget as HTMLButtonElement).style.background = '#fafafa' }}
                  onMouseLeave={e => { if (b.id !== boutiqueId) (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
                >
                  {b.name}
                  {b.prefix && <span style={{ color: '#999', fontSize: 11, marginLeft: 6 }}>[{b.prefix}]</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="topbar-spacer" />

        <div className="topbar-actions">
          <span title="Langue"><Globe size={14} /></span>
          <span title="Feedback"><MessageSquare size={14} /> Feedback</span>
          <span title="Mises à jour"><Bell size={14} /> Mises à jour</span>
          <span title="Tutoriels"><BookOpen size={14} /> Tutoriels</span>
          <div className="user-chip" onClick={handleLogout} title="Se déconnecter">
            <User size={13} />
            <span>Admin</span>
            <LogOut size={11} style={{ opacity: 0.7 }} />
          </div>
        </div>
      </div>

      {/* ── Body: sidebar + page content ──────────────────────────────────── */}
      <div className="dash-body">
        <Sidebar activeItem={activeItem} onItemClick={handleSidebarClick} />

        {/* Page content area — each page fills this with its own layout */}
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
