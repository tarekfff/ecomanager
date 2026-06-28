'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useBoutique } from '@/contexts/BoutiqueContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { useUI } from '@/contexts/UIContext'
import {
  ChevronDown, ChevronRight,
  ShoppingCart, Users, Package, Boxes, Tag, Building2,
  Truck, BarChart2, Banknote, Database, Zap, Shield,
  Store, Settings, PlusCircle, List, Upload, Archive,
  Trash2, Receipt, RotateCcw, SlidersHorizontal, ArrowUpDown,
  Layers, AlertTriangle, ClipboardList, TrendingUp, CreditCard,
  Megaphone, Download, FileText, Link, UserCog, PackageCheck,
  PackageX, FilePlus, Search, BookOpen, ShoppingBag,
} from 'lucide-react'

// ── Tokens ───────────────────────────────────────────────────
const S = {
  bg:          '#16192A',
  headerBg:    '#12152200',
  text:        'rgba(255,255,255,0.55)',
  textHover:   'rgba(255,255,255,0.82)',
  textActive:  '#E891CF',
  iconMuted:   'rgba(255,255,255,0.30)',
  iconActive:  '#BF4C98',
  activeBg:    'rgba(191,76,152,0.13)',
  hoverBg:     'rgba(255,255,255,0.045)',
  sectionFg:   'rgba(255,255,255,0.22)',
  divider:     'rgba(255,255,255,0.06)',
  primary:     '#BF4C98',
  newBadge:    '#f59e0b',
}

// ── Types ────────────────────────────────────────────────────
type ChildItem =
  | { type?: 'item'; icon?: React.ElementType; label: string; href?: string }
  | { type: 'section'; label: string }

interface NavGroup {
  icon:     React.ElementType
  label:    string
  badge?:   string
  /** Permission guard: show this group only when canAny(perm) is true.
   *  Omit (undefined) to always show. */
  perm?:    string | string[]
  children: ChildItem[]
}

interface SidebarSection {
  sectionLabel?: string
  groups:        NavGroup[]
}

const sec = (label: string): ChildItem => ({ type: 'section', label })
const it  = (icon: React.ElementType, label: string, href?: string): ChildItem => ({ icon, label, href })

// ── Nav tree ─────────────────────────────────────────────────
const SECTIONS: SidebarSection[] = [
  {
    groups: [
      {
        icon: ShoppingCart, label: 'Commandes',
        perm: 'orders',  // canAny('orders') → any orders.* permission
        children: [
          it(FilePlus,      'Nouvelle commande',   '/dashboard/orders/new'),
          it(Upload,        'Import Google Sheet', '/dashboard/orders/import/google-sheet'),
          it(Link,          'Sources connectées',  '/dashboard/orders/import/sources'),
          sec('Pipeline'),
          it(ClipboardList, 'En confirmation', '/dashboard/orders/en-confirmation'),
          it(Package,       'En préparation',  '/dashboard/orders/en-preparation'),
          it(Truck,         'En dispatch',     '/dashboard/orders/en-dispatch'),
          it(Truck,         'En livraison',    '/dashboard/orders/en-livraison'),
          it(PackageCheck,  'Livrées',         '/dashboard/orders/livrees'),
          it(RotateCcw,     'En retour',       '/dashboard/orders/en-retour'),
          sec('Archives'),
          it(Archive,   'Encaissées', '/dashboard/orders/archives/encaissees'),
          it(Archive,   'Retournées', '/dashboard/orders/archives/retournees'),
          it(Archive,   'Annulées',   '/dashboard/orders/archives/annulees'),
          it(Trash2,    'Corbeille',  '/dashboard/orders/corbeille'),
          sec('Bons'),
          it(Receipt,   "Bon d'encaissement", '/dashboard/orders/bons/encaissement'),
          it(RotateCcw, 'Bon de retour',      '/dashboard/orders/bons/retour'),
          sec('Pickups'),
          it(Truck,        'En collecte', '/dashboard/orders/pickups/en-collecte'),
          it(Package,      'Collecté',    '/dashboard/orders/pickups/collecte'),
          it(PackageCheck, 'Reçus',       '/dashboard/orders/pickups/recus'),
          it(PackageCheck, 'Traités',     '/dashboard/orders/pickups/traites'),
          it(PackageX,     'Annulés',     '/dashboard/orders/pickups/annules'),
        ],
      },
      {
        icon: Users, label: 'Clients',
        perm: 'config.clients',
        children: [
          it(List,       'Liste des clients',    '/dashboard/clients'),
          it(PlusCircle, 'Ajouter un client',    '/dashboard/clients'),
          it(Upload,     'Import en masse',      '/dashboard/clients/import'),
          it(Search,     'Rechercher un client', '/dashboard/clients'),
        ],
      },
      {
        icon: Package, label: 'Produits',
        perm: 'products.view',
        children: [
          it(List,       'Liste des produits', '/dashboard/products'),
          it(PlusCircle, 'Ajouter un produit', '/dashboard/products/new'),
          it(Upload,     'Import en masse',    '/dashboard/products/import'),
          it(Tag,        'Options & attributs', '/dashboard/products/options'),
        ],
      },
    ],
  },
  {
    sectionLabel: 'Stock',
    groups: [
      {
        icon: Boxes, label: 'Gestion de stock',
        perm: 'stock',  // canAny('stock') → any stock.* permission
        children: [
          it(SlidersHorizontal, 'Ajustement de stock', '/dashboard/stock/ajustement'),
          it(ArrowUpDown,       'Mouvements de stock', '/dashboard/stock/mouvements'),
          it(Layers,            'Lots de stock',       '/dashboard/stock/lots'),
          it(AlertTriangle,     'Alertes de stock',    '/dashboard/stock/alertes'),
          it(ClipboardList,     'Inventaire',          '/dashboard/stock/inventaire'),
          it(ClipboardList,     'Méga inventaire',     '/dashboard/stock/mega-inventaire'),
        ],
      },
      {
        icon: Tag, label: 'Marques',
        perm: 'brands',  // canAny('brands') → brands.create / .edit / .delete
        children: [
          it(List,       'Liste des marques',   '/dashboard/marques'),
          it(PlusCircle, 'Ajouter une marque',  '/dashboard/marques'),
        ],
      },
      {
        icon: Building2, label: 'Fournisseurs',
        perm: 'suppliers',
        children: [
          it(List,       'Liste des fournisseurs',   '/dashboard/fournisseurs'),
          it(PlusCircle, 'Ajouter un fournisseur',   '/dashboard/fournisseurs'),
        ],
      },
    ],
  },
  {
    sectionLabel: 'Livraison',
    groups: [
      {
        icon: Truck, label: 'Livraison',
        perm: 'config.delivery',
        children: [
          it(List,       'Liste des livreurs',  '/dashboard/livraison/livreurs'),
          it(PlusCircle, 'Ajouter un livreur',  '/dashboard/livraison/livreurs'),
        ],
      },
    ],
  },
  {
    sectionLabel: 'Analyse',
    groups: [
      {
        icon: BarChart2, label: 'Statistiques', badge: 'new',
        perm: 'stats',
        children: [
          it(Store,    'Par boutique',     '/dashboard/stats/boutique'),
          it(Package,  'Par produit',      '/dashboard/stats/produit'),
          it(UserCog,  'Par confirmateur', '/dashboard/stats/confirmateur'),
          it(Truck,    'Par livreur',      '/dashboard/stats/livreur'),
          it(BookOpen, 'Par wilaya',       '/dashboard/stats/wilaya'),
        ],
      },
      {
        icon: Banknote, label: 'Comptabilité',
        perm: 'accounting',
        children: [
          it(FileText,   'Bilan général',       '/dashboard/comptabilite/bilan'),
          it(TrendingUp, 'Rentabilité produit', '/dashboard/comptabilite/rentabilite'),
          it(CreditCard, 'Saisir des dépenses', '/dashboard/comptabilite/depenses'),
          it(Megaphone,  'Coûts publicitaires', '/dashboard/comptabilite/publicite'),
        ],
      },
      {
        icon: Database, label: 'Données',
        perm: 'data',
        children: [
          it(Download,  'Exporter les données', '/dashboard/donnees/export'),
          it(BarChart2, 'Rapports',             '/dashboard/donnees/rapports'),
        ],
      },
    ],
  },
  {
    sectionLabel: 'Système',
    groups: [
      {
        icon: Zap, label: 'Webhooks',
        perm: 'webhooks',
        children: [
          it(List,       'Liste des webhooks', '/dashboard/webhooks'),
          it(PlusCircle, 'Ajouter un webhook', '/dashboard/webhooks'),
          it(FileText,   'Logs',               '/dashboard/webhooks/logs'),
        ],
      },
      {
        icon: Shield, label: 'Modérateurs',
        perm: ['config.users', 'config.roles'],
        children: [
          it(Users,  'Utilisateurs',        '/dashboard/moderateurs/utilisateurs'),
          it(Shield, 'Rôles & permissions', '/dashboard/moderateurs/roles'),
        ],
      },
      {
        icon: Store, label: 'Boutiques',
        perm: 'config.boutiques',
        children: [
          it(List,       'Liste des boutiques',   '/dashboard/boutiques'),
          it(PlusCircle, 'Ajouter une boutique',  '/dashboard/boutiques'),
        ],
      },
      {
        icon: Settings, label: 'Configuration',
        perm: 'config',
        children: [
          it(SlidersHorizontal, 'Statuts de livraison',    '/dashboard/config/statuts'),
          it(SlidersHorizontal, 'Statuts de confirmation', '/dashboard/config/statuts'),
          it(Link,              "Sources d'import",         '/dashboard/config/sources'),
          it(Truck,             'Config. livraison',        '/dashboard/config/livraison'),
          it(Users,             'Config. clients',          '/dashboard/config/clients'),
          it(CreditCard,        'Abonnement',               '/dashboard/config/abonnement'),
          it(Settings,          'Paramètres avancés',       '/dashboard/config/avance'),
        ],
      },
    ],
  },
]

// ── Props ─────────────────────────────────────────────────────
interface SidebarProps {
  activeItem?:   string
  boutiqueName?: string
  onItemClick?:  (label: string) => void
}

// ── Component ─────────────────────────────────────────────────
export default function Sidebar({ activeItem, boutiqueName, onItemClick }: SidebarProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const { boutiqueName: ctxBoutiqueName } = useBoutique()
  const { canAny, ready: permsReady } = usePermissions()
  const { isMobile, sidebarOpen, closeSidebar } = useUI()
  const displayBoutiqueName = boutiqueName ?? ctxBoutiqueName
  const [open, setOpen] = useState<Record<string, boolean>>({ Commandes: true })

  // Determine whether a group is visible to this user
  function groupVisible(perm?: string | string[]): boolean {
    if (!perm) return true          // no guard → always visible
    if (!permsReady) return false   // hide until permissions are loaded
    return canAny(perm)
  }

  // Find the active child label by picking the most specific href match (longest path wins).
  const activeLabel = useMemo(() => {
    const matches: { label: string; len: number }[] = []
    for (const section of SECTIONS) {
      for (const group of section.groups) {
        for (const child of group.children) {
          if (child.type === 'section' || !child.href) continue
          if (pathname === child.href || pathname.startsWith(child.href + '/')) {
            matches.push({ label: child.label, len: child.href.length })
          }
        }
      }
    }
    if (matches.length === 0) return activeItem ?? ''
    const maxLen = Math.max(...matches.map(m => m.len))
    return matches.find(m => m.len === maxLen)?.label ?? activeItem ?? ''
  }, [pathname, activeItem])

  // Auto-expand parent group when a child matches current URL
  useEffect(() => {
    if (!activeLabel) return
    for (const section of SECTIONS) {
      for (const group of section.groups) {
        if (group.children.some(c => c.type !== 'section' && c.label === activeLabel)) {
          setOpen(prev => ({ ...prev, [group.label]: true }))
          return
        }
      }
    }
  }, [activeLabel])

  function toggle(label: string) {
    setOpen(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function hasActiveChild(children: ChildItem[]): boolean {
    return children.some(c => c.type !== 'section' && c.label === activeLabel)
  }

  function handleChildClick(label: string, href?: string) {
    if (href) router.push(href)
    else onItemClick?.(label)
    if (isMobile) closeSidebar() // collapse the drawer after navigating
  }

  // On medium/small screens the sidebar is an off-canvas drawer; on desktop it
  // stays a normal static flex child.
  const mobileStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 1000,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.3)' : 'none',
      }
    : {}

  return (
    <nav
      className="chic-sidebar"
      style={{
        width: 228, minWidth: 228, background: S.bg,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', fontFamily: "'Inter', sans-serif",
        borderRight: `1px solid ${S.divider}`,
        ...mobileStyle,
      }}
    >
      {/* ── Brand header ── */}
      <div style={{ padding: '18px 16px 16px', flexShrink: 0 }}>
        <div
          onClick={() => router.push('/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(140deg, #BF4C98 0%, #7B1E5A 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.08)',
          }}>
            <ShoppingBag size={17} color="#fff" strokeWidth={1.8} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              chic<span style={{ color: '#E891CF' }}>N</span>
            </div>
            {displayBoutiqueName && (
              <div style={{ fontSize: 11, color: S.text, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                {displayBoutiqueName}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: S.divider, marginBottom: 6, flexShrink: 0 }} />

      {/* ── Navigation ── */}
      <div style={{ flex: 1, padding: '4px 8px 20px' }}>
        {SECTIONS.map((section, si) => {
          // Only render section header if at least one group in it is visible
          const visibleGroups = section.groups.filter(g => groupVisible(g.perm))
          if (visibleGroups.length === 0) return null

          return (
            <div key={si} style={{ marginTop: si === 0 ? 0 : 6 }}>
              {section.sectionLabel && (
                <div style={{
                  padding: '10px 8px 4px', fontSize: 10.5, fontWeight: 600,
                  color: S.sectionFg, textTransform: 'uppercase', letterSpacing: '0.8px',
                }}>
                  {section.sectionLabel}
                </div>
              )}

              {visibleGroups.map(({ icon: Icon, label, badge, children }) => {
                const isOpen      = !!open[label]
                const childActive = hasActiveChild(children)
                const parentSelf  = activeLabel === label

                return (
                  <div key={label}>
                    {/* ── Parent row ── */}
                    <button
                      onClick={() => toggle(label)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', padding: '7px 8px',
                        borderRadius: 7, border: 'none', cursor: 'pointer',
                        fontSize: 13.5, fontWeight: childActive ? 600 : 500,
                        color: parentSelf ? S.textActive : childActive ? 'rgba(255,255,255,0.90)' : S.text,
                        background: parentSelf ? S.activeBg : 'transparent',
                        fontFamily: "'Inter', sans-serif",
                        transition: 'color .12s, background .12s', userSelect: 'none',
                      }}
                      onMouseEnter={e => {
                        if (!parentSelf) (e.currentTarget as HTMLButtonElement).style.background = S.hoverBg
                        if (!parentSelf && !childActive) (e.currentTarget as HTMLButtonElement).style.color = S.textHover
                      }}
                      onMouseLeave={e => {
                        if (!parentSelf) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        if (!parentSelf && !childActive) (e.currentTarget as HTMLButtonElement).style.color = S.text
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Icon
                          size={15}
                          strokeWidth={childActive || parentSelf ? 2.2 : 1.8}
                          color={childActive || parentSelf ? S.iconActive : S.iconMuted}
                          style={{ flexShrink: 0 }}
                        />
                        <span>{label}</span>
                        {badge && (
                          <span style={{
                            background: S.newBadge, color: '#fff', borderRadius: 4,
                            padding: '0px 5px', fontSize: 9, fontWeight: 700,
                            letterSpacing: '0.3px', lineHeight: '18px',
                          }}>
                            NEW
                          </span>
                        )}
                      </div>
                      {isOpen
                        ? <ChevronDown  size={12} color="rgba(255,255,255,0.22)" />
                        : <ChevronRight size={12} color="rgba(255,255,255,0.18)" />
                      }
                    </button>

                    {/* ── Children ── */}
                    {isOpen && (
                      <div style={{ marginTop: 1, marginBottom: 2 }}>
                        {children.map((child, idx) => {
                          if (child.type === 'section') {
                            return (
                              <div key={`s${idx}`} style={{
                                padding: '6px 8px 3px 36px', fontSize: 10, fontWeight: 600,
                                color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase',
                                letterSpacing: '0.7px', marginTop: idx === 0 ? 0 : 4,
                              }}>
                                {child.label}
                              </div>
                            )
                          }
                          const isActive = child.label === activeLabel
                          return (
                            <button
                              key={`${child.label}-${idx}`}
                              onClick={() => handleChildClick(child.label, child.href)}
                              style={{
                                width: '100%', display: 'flex', alignItems: 'center',
                                padding: '6px 8px 6px 34px', borderRadius: 6, border: 'none',
                                cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400,
                                color: isActive ? S.textActive : S.text,
                                background: isActive ? S.activeBg : 'transparent',
                                fontFamily: "'Inter', sans-serif", textAlign: 'left',
                                transition: 'color .1s, background .1s', userSelect: 'none',
                              }}
                              onMouseEnter={e => {
                                if (!isActive) {
                                  (e.currentTarget as HTMLButtonElement).style.background = S.hoverBg
                                  ;(e.currentTarget as HTMLButtonElement).style.color = S.textHover
                                }
                              }}
                              onMouseLeave={e => {
                                if (!isActive) {
                                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                                  ;(e.currentTarget as HTMLButtonElement).style.color = S.text
                                }
                              }}
                            >
                              {child.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: '10px 16px 14px', borderTop: `1px solid ${S.divider}`,
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7,
        fontSize: 11, color: S.sectionFg,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
        chicN · V1
      </div>
    </nav>
  )
}
