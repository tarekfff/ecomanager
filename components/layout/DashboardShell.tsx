'use client'
import { useEffect, useRef, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Globe, MessageSquare, Bell, BookOpen, LogOut, ChevronDown, ShoppingBag, Store, ShoppingCart } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import { useBoutique } from '@/contexts/BoutiqueContext'
import { colors, fonts } from '@/lib/tokens'

interface BoutiqueOption { id: string; name: string; prefix: string }

const ITEM_ROUTES: Record<string, string> = {
  // Orders
  'Nouvelle commande':   '/dashboard/orders/new',
  'Import Google Sheet':   '/dashboard/orders/import/google-sheet',
  'Sources connectées':    '/dashboard/orders/import/sources',
  'En confirmation':     '/dashboard/orders/en-confirmation',
  'En préparation':      '/dashboard/orders/en-preparation',
  'En dispatch':         '/dashboard/orders/en-dispatch',
  'En livraison':        '/dashboard/orders/en-livraison',
  'Livrées':             '/dashboard/orders/livrees',
  'En retour':           '/dashboard/orders/en-retour',
  'Encaissées':          '/dashboard/orders/archives/encaissees',
  'Retournées':          '/dashboard/orders/archives/retournees',
  'Annulées':            '/dashboard/orders/archives/annulees',
  'Corbeille':           '/dashboard/orders/corbeille',
  // Bons
  "Bon d'encaissement":  '/dashboard/orders/bons/encaissement',
  'Bon de retour':       '/dashboard/orders/bons/retour',
  // Pickups
  'En collecte':         '/dashboard/orders/pickups/en-collecte',
  'Collecté':            '/dashboard/orders/pickups/collecte',
  'Reçus':               '/dashboard/orders/pickups/recus',
  'Traités':             '/dashboard/orders/pickups/traites',
  'Annulés':             '/dashboard/orders/pickups/annules',
  // Clients
  'Liste des clients':   '/dashboard/clients',
  'Import clients':      '/dashboard/clients/import',
  // Products
  'Liste des produits':  '/dashboard/products',
  'Ajouter un produit':  '/dashboard/products/new',
  'Import en masse':     '/dashboard/products/import',
  'Options & attributs': '/dashboard/products/options',
  // Livraison
  'Liste des livreurs':  '/dashboard/livraison/livreurs',
  'Ajouter un livreur':  '/dashboard/livraison/livreurs',
  
  // Statistiques
  'Par boutique':        '/dashboard/stats/boutique',
  'Par produit':         '/dashboard/stats/produit',
  'Par confirmateur':    '/dashboard/stats/confirmateur',
  'Par livreur':         '/dashboard/stats/livreur',
  'Par wilaya':          '/dashboard/stats/wilaya',
  // Comptabilité
  'Bilan général':       '/dashboard/comptabilite/ajustement',
}

function getActiveItem(pathname: string): string {
  if (pathname.startsWith('/dashboard/orders/new'))              return 'Nouvelle commande'
  if (pathname.startsWith('/dashboard/orders/import/sources'))       return 'Sources connectées'
  if (pathname.startsWith('/dashboard/orders/import/google-sheet')) return 'Import Google Sheet'
  if (pathname.startsWith('/dashboard/orders/en-confirmation'))  return 'En confirmation'
  if (pathname.startsWith('/dashboard/orders/en-preparation'))   return 'En préparation'
  if (pathname.startsWith('/dashboard/orders/en-dispatch'))      return 'En dispatch'
  if (pathname.startsWith('/dashboard/orders/en-livraison'))     return 'En livraison'
  if (pathname.startsWith('/dashboard/orders/livrees'))          return 'Livrées'
  if (pathname.startsWith('/dashboard/orders/en-retour'))              return 'En retour'
  if (pathname.startsWith('/dashboard/orders/archives/encaissees'))    return 'Encaissées'
  if (pathname.startsWith('/dashboard/orders/archives/retournees'))    return 'Retournées'
  if (pathname.startsWith('/dashboard/orders/archives/annulees'))      return 'Annulées'
  if (pathname.startsWith('/dashboard/orders/corbeille'))              return 'Corbeille'
  if (pathname.startsWith('/dashboard/orders/bons/encaissement'))      return "Bon d'encaissement"
  if (pathname.startsWith('/dashboard/orders/bons/retour'))            return 'Bon de retour'
  if (pathname.startsWith('/dashboard/orders/pickups/en-collecte'))    return 'En collecte'
  if (pathname.startsWith('/dashboard/orders/pickups/collecte'))       return 'Collecté'
  if (pathname.startsWith('/dashboard/orders/pickups/recus'))          return 'Reçus'
  if (pathname.startsWith('/dashboard/orders/pickups/traites'))        return 'Traités'
  if (pathname.startsWith('/dashboard/orders/pickups/annules'))        return 'Annulés'
  if (pathname === '/dashboard/clients/import')                  return 'Import clients'
  if (pathname.startsWith('/dashboard/clients'))                 return 'Liste des clients'
  if (pathname.startsWith('/dashboard/products/new'))            return 'Ajouter un produit'
  if (pathname.startsWith('/dashboard/products/options'))        return 'Options & attributs'
  if (pathname.startsWith('/dashboard/products/import'))         return 'Import en masse'
  if (pathname.startsWith('/dashboard/products'))                return 'Liste des produits'
  if (pathname.startsWith('/dashboard/livraison/livreurs'))  return 'Liste des livreurs'
  if (pathname.startsWith('/dashboard/stats/boutique'))       return 'Par boutique'
  if (pathname.startsWith('/dashboard/stats/produit'))        return 'Par produit'
  if (pathname.startsWith('/dashboard/stats/confirmateur'))   return 'Par confirmateur'
  if (pathname.startsWith('/dashboard/stats/livreur'))        return 'Par livreur'
  if (pathname.startsWith('/dashboard/stats/wilaya'))              return 'Par wilaya'
  if (pathname.startsWith('/dashboard/comptabilite/bilan'))        return 'Bilan général'
  return ''
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const { boutiqueId, boutiqueName, setBoutique } = useBoutique()

  const [ready,            setReady]            = useState(false)
  const [boutiques,        setBoutiques]        = useState<BoutiqueOption[]>([])
  const [showBoutiqueMenu, setShowBoutiqueMenu] = useState(false)
  const [showNavMenu,      setShowNavMenu]      = useState(false)
  const boutiqueMenuRef = useRef<HTMLDivElement>(null)
  const navMenuRef      = useRef<HTMLDivElement>(null)

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
    function onOutside(e: MouseEvent) {
      if (boutiqueMenuRef.current && !boutiqueMenuRef.current.contains(e.target as Node)) {
        setShowBoutiqueMenu(false)
      }
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node)) {
        setShowNavMenu(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

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
        <div
          onClick={() => router.push('/dashboard')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginRight: 20, flexShrink: 0,
            cursor: 'pointer',
          }}
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

        {/* ── Nav: pipeline quick-links ── */}
        <div ref={navMenuRef} style={{ position: 'relative', marginLeft: 12 }}>
          <button
            onClick={() => setShowNavMenu(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: showNavMenu ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.0)',
              border: 'none', borderRadius: 6,
              padding: '5px 10px', cursor: 'pointer',
              fontSize: 12.5, color: 'rgba(255,255,255,0.92)',
              fontFamily: fonts.sans, fontWeight: 500,
              transition: 'background .15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = showNavMenu ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.0)'}
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
              {/* New order shortcut */}
              <button
                onClick={() => { router.push('/dashboard/orders/new'); setShowNavMenu(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left',
                  padding: '9px 14px', fontSize: 13, fontFamily: fonts.sans,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  color: colors.primary, fontWeight: 600,
                  borderBottom: `1px solid #f0e8f0`,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = colors.primaryLt}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
              >
                + Nouvelle commande
              </button>

              {/* Pipeline stages */}
              {[
                { label: 'En confirmation', path: '/dashboard/orders/en-confirmation', dot: '#4472C4' },
                { label: 'En préparation',  path: '/dashboard/orders/en-preparation',  dot: '#9966CC' },
                { label: 'En dispatch',     path: '/dashboard/orders/en-dispatch',      dot: '#E6B800' },
                { label: 'En livraison',    path: '/dashboard/orders/en-livraison',     dot: '#888888' },
                { label: 'Livrées',         path: '/dashboard/orders/livrees',          dot: '#00B0A0' },
                { label: 'En retour',       path: '/dashboard/orders/en-retour',        dot: '#E84B6A' },
              ].map(({ label, path, dot }) => {
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
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#fafafa' }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
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
        <Sidebar activeItem={activeItem} boutiqueName={displayName} onItemClick={handleSidebarClick} />

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
