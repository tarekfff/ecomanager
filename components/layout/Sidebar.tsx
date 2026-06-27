'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  headerBg:    '#12152200',   // transparent — blends with bg
  text:        'rgba(255,255,255,0.55)',
  textHover:   'rgba(255,255,255,0.82)',
  textActive:  '#E891CF',          // pink — active label
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
  | { type?: 'item'; icon?: React.ElementType; label: string }
  | { type: 'section'; label: string }

interface NavGroup {
  icon:      React.ElementType
  label:     string
  badge?:    string
  children:  ChildItem[]
}

interface SidebarSection {
  sectionLabel?: string
  groups:        NavGroup[]
}

const sec = (label: string): ChildItem => ({ type: 'section', label })
const it  = (icon: React.ElementType, label: string): ChildItem => ({ icon, label })

// ── Nav tree ─────────────────────────────────────────────────
const SECTIONS: SidebarSection[] = [
  {
    groups: [
      {
        icon: ShoppingCart, label: 'Commandes',
        children: [
          it(FilePlus,     'Nouvelle commande'),
          it(Upload,       'Import Google Sheet'),
          it(Link,         'Sources connectées'),
          sec('Pipeline'),
          it(ClipboardList,'En confirmation'),
          it(Package,      'En préparation'),
          it(Truck,        'En dispatch'),
          it(Truck,        'En livraison'),
          it(PackageCheck, 'Livrées'),
          it(RotateCcw,    'En retour'),
          sec('Archives'),
          it(Archive,      'Encaissées'),
          it(Archive,      'Retournées'),
          it(Archive,      'Annulées'),
          it(Trash2,       'Corbeille'),
          sec('Bons'),
          it(Receipt,      "Bon d'encaissement"),
          it(RotateCcw,    'Bon de retour'),
          sec('Pickups'),
          it(Truck,        'En collecte'),
          it(Package,      'Collecté'),
          it(PackageCheck, 'Reçus'),
          it(PackageCheck, 'Traités'),
          it(PackageX,     'Annulés'),
        ],
      },
      {
        icon: Users, label: 'Clients',
        children: [
          it(List,       'Liste des clients'),
          it(PlusCircle, 'Ajouter un client'),
          it(Upload,     'Import en masse'),
          it(Search,     'Rechercher un client'),
        ],
      },
      {
        icon: Package, label: 'Produits',
        children: [
          it(List,       'Liste des produits'),
          it(PlusCircle, 'Ajouter un produit'),
          it(Upload,     'Import en masse'),
          it(Tag,        'Options & attributs'),
        ],
      },
    ],
  },
  {
    sectionLabel: 'Stock',
    groups: [
      {
        icon: Boxes, label: 'Gestion de stock',
        children: [
          it(SlidersHorizontal, 'Ajustement de stock'),
          it(ArrowUpDown,       'Mouvements de stock'),
          it(Layers,            'Lots de stock'),
          it(AlertTriangle,     'Alertes de stock'),
          it(ClipboardList,     'Inventaire'),
          it(ClipboardList,     'Méga inventaire'),
        ],
      },
      { icon: Tag,       label: 'Marques',      children: [it(List, 'Liste des marques'),      it(PlusCircle, 'Ajouter une marque')]    },
      { icon: Building2, label: 'Fournisseurs', children: [it(List, 'Liste des fournisseurs'), it(PlusCircle, 'Ajouter un fournisseur')] },
    ],
  },
  {
    sectionLabel: 'Livraison',
    groups: [
      { icon: Truck, label: 'Livraison', children: [it(List, 'Liste des livreurs'), it(PlusCircle, 'Ajouter un livreur')] },
    ],
  },
  {
    sectionLabel: 'Analyse',
    groups: [
      {
        icon: BarChart2, label: 'Statistiques', badge: 'new',
        children: [
          it(Store,    'Par boutique'),
          it(Package,  'Par produit'),
          it(UserCog,  'Par confirmateur'),
          it(Truck,    'Par livreur'),
          it(BookOpen, 'Par wilaya'),
        ],
      },
      {
        icon: Banknote, label: 'Comptabilité',
        children: [
          it(FileText,   'Bilan général'),
          it(TrendingUp, 'Rentabilité produit'),
          it(CreditCard, 'Saisir des dépenses'),
          it(Megaphone,  'Coûts publicitaires'),
        ],
      },
      { icon: Database, label: 'Données', children: [it(Download, 'Exporter les données'), it(BarChart2, 'Rapports')] },
    ],
  },
  {
    sectionLabel: 'Système',
    groups: [
      { icon: Zap,      label: 'Webhooks',     children: [it(List, 'Liste des webhooks'), it(PlusCircle, 'Ajouter un webhook'), it(FileText, 'Logs')] },
      { icon: Shield,   label: 'Modérateurs',  children: [it(Users, 'Utilisateurs'), it(Shield, 'Rôles & permissions')] },
      { icon: Store,    label: 'Boutiques',    children: [it(List, 'Liste des boutiques'), it(PlusCircle, 'Ajouter une boutique')] },
      {
        icon: Settings, label: 'Configuration',
        children: [
          it(SlidersHorizontal, 'Statuts de livraison'),
          it(SlidersHorizontal, 'Statuts de confirmation'),
          it(Link,              "Sources d'import"),
          it(Truck,             'Config. livraison'),
          it(Users,             'Config. clients'),
          it(CreditCard,        'Abonnement'),
          it(Settings,          'Paramètres avancés'),
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
  const router = useRouter()
  const [open, setOpen] = useState<Record<string, boolean>>({ Commandes: true })

  // Auto-open parent group when navigating to a child page
  useEffect(() => {
    if (!activeItem) return
    for (const sec of SECTIONS) {
      for (const group of sec.groups) {
        if (group.children.some(c => c.type !== 'section' && c.label === activeItem)) {
          setOpen(prev => ({ ...prev, [group.label]: true }))
          return
        }
      }
    }
  }, [activeItem])

  function toggle(label: string) {
    setOpen(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function hasActiveChild(children: ChildItem[]): boolean {
    return children.some(c => c.type !== 'section' && c.label === activeItem)
  }

  return (
    <nav
      className="chic-sidebar"
      style={{
        width: 228,
        minWidth: 228,
        background: S.bg,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        fontFamily: "'Inter', sans-serif",
        borderRight: `1px solid ${S.divider}`,
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
            {boutiqueName && (
              <div style={{ fontSize: 11, color: S.text, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                {boutiqueName}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: S.divider, marginBottom: 6, flexShrink: 0 }} />

      {/* ── Navigation ── */}
      <div style={{ flex: 1, padding: '4px 8px 20px' }}>
        {SECTIONS.map((section, si) => (
          <div key={si} style={{ marginTop: si === 0 ? 0 : 6 }}>

            {/* Section label */}
            {section.sectionLabel && (
              <div style={{
                padding: '10px 8px 4px',
                fontSize: 10.5, fontWeight: 600,
                color: S.sectionFg,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
              }}>
                {section.sectionLabel}
              </div>
            )}

            {section.groups.map(({ icon: Icon, label, badge, children }) => {
              const isOpen      = !!open[label]
              const childActive = hasActiveChild(children)
              const parentSelf  = activeItem === label

              return (
                <div key={label}>

                  {/* ── Parent row ── */}
                  <button
                    onClick={() => { toggle(label); onItemClick?.(label) }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: 7,
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 13.5,
                      fontWeight: childActive ? 600 : 500,
                      color: parentSelf
                        ? S.textActive
                        : childActive
                          ? 'rgba(255,255,255,0.90)'
                          : S.text,
                      background: parentSelf
                        ? S.activeBg
                        : 'transparent',
                      fontFamily: "'Inter', sans-serif",
                      transition: 'color .12s, background .12s',
                      userSelect: 'none',
                    }}
                    onMouseEnter={e => {
                      if (!parentSelf)
                        (e.currentTarget as HTMLButtonElement).style.background = S.hoverBg
                      if (!parentSelf && !childActive)
                        (e.currentTarget as HTMLButtonElement).style.color = S.textHover
                    }}
                    onMouseLeave={e => {
                      if (!parentSelf)
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                      if (!parentSelf && !childActive)
                        (e.currentTarget as HTMLButtonElement).style.color = S.text
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
                          background: S.newBadge, color: '#fff',
                          borderRadius: 4, padding: '0px 5px',
                          fontSize: 9, fontWeight: 700,
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

                        /* Sub-section label (Archives, Bons, Pickups) */
                        if (child.type === 'section') {
                          return (
                            <div key={`s${idx}`} style={{
                              padding: '6px 8px 3px 36px',
                              fontSize: 10, fontWeight: 600,
                              color: 'rgba(255,255,255,0.18)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.7px',
                              marginTop: idx === 0 ? 0 : 4,
                            }}>
                              {child.label}
                            </div>
                          )
                        }

                        /* Child item */
                        const isActive = activeItem === child.label

                        return (
                          <button
                            key={child.label}
                            onClick={() => onItemClick?.(child.label)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center',
                              gap: 0,
                              padding: '6px 8px 6px 34px',
                              borderRadius: 6,
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 13,
                              fontWeight: isActive ? 600 : 400,
                              color: isActive ? S.textActive : S.text,
                              background: isActive ? S.activeBg : 'transparent',
                              fontFamily: "'Inter', sans-serif",
                              textAlign: 'left',
                              transition: 'color .1s, background .1s',
                              userSelect: 'none',
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
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{
        padding: '10px 16px 14px',
        borderTop: `1px solid ${S.divider}`,
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 7,
        fontSize: 11, color: S.sectionFg,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
        chicN · V1
      </div>
    </nav>
  )
}
