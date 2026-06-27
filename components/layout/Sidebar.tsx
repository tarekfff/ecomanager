'use client'
import { useState } from 'react'
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

// ── Dark sidebar tokens ───────────────────────────────────────
const D = {
  bg:           '#181C2E',
  headerBg:     '#141728',
  text:         'rgba(255,255,255,0.82)',
  textDim:      'rgba(255,255,255,0.40)',
  textActive:   '#ffffff',
  icon:         'rgba(255,255,255,0.38)',
  primary:      '#BF4C98',
  primaryBg:    'rgba(191,76,152,0.16)',
  primaryFg:    '#E891CF',
  hover:        'rgba(255,255,255,0.05)',
  border:       'rgba(255,255,255,0.07)',
  sectionLabel: 'rgba(255,255,255,0.28)',
  badgeBg:      'rgba(255,255,255,0.10)',
  badgeFg:      'rgba(255,255,255,0.60)',
  newBadge:     '#ff9800',
  childSec:     'rgba(255,255,255,0.22)',
}

// ── Types ────────────────────────────────────────────────────
type ChildItem =
  | { type?: 'item'; icon?: React.ElementType; label: string }
  | { type: 'section'; label: string }

interface NavGroup {
  icon: React.ElementType
  label: string
  badge?: string
  children: ChildItem[]
}

interface SidebarSection {
  sectionLabel?: string
  groups: NavGroup[]
}

const sec = (label: string): ChildItem => ({ type: 'section', label })
const it  = (icon: React.ElementType, label: string): ChildItem => ({ icon, label })

// ── Navigation structure with top-level sections ─────────────
const SECTIONS: SidebarSection[] = [
  {
    groups: [
      {
        icon: ShoppingCart, label: 'Commandes',
        children: [
          it(FilePlus,     'Nouvelle commande'),
          it(Upload,       'Import Google Sheet'),
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
    sectionLabel: 'STOCK',
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
      {
        icon: Tag, label: 'Marques',
        children: [
          it(List,       'Liste des marques'),
          it(PlusCircle, 'Ajouter une marque'),
        ],
      },
      {
        icon: Building2, label: 'Fournisseurs',
        children: [
          it(List,       'Liste des fournisseurs'),
          it(PlusCircle, 'Ajouter un fournisseur'),
        ],
      },
    ],
  },
  {
    sectionLabel: 'LIVRAISON',
    groups: [
      {
        icon: Truck, label: 'Livraison',
        children: [
          it(List,       'Liste des livreurs'),
          it(PlusCircle, 'Ajouter un livreur'),
        ],
      },
    ],
  },
  {
    sectionLabel: 'ANALYSE',
    groups: [
      {
        icon: BarChart2, label: 'Statistiques V2', badge: 'new',
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
      {
        icon: Database, label: 'Données',
        children: [
          it(Download,  'Exporter les données'),
          it(BarChart2, 'Rapports'),
        ],
      },
    ],
  },
  {
    sectionLabel: 'SYSTÈME',
    groups: [
      {
        icon: Zap, label: 'Webhooks',
        children: [
          it(List,       'Liste des webhooks'),
          it(PlusCircle, 'Ajouter un webhook'),
          it(FileText,   'Logs des webhooks'),
        ],
      },
      {
        icon: Shield, label: 'Modérateurs',
        children: [
          it(Users,  'Gestion des utilisateurs'),
          it(Shield, 'Rôles & permissions'),
        ],
      },
      {
        icon: Store, label: 'Boutiques',
        children: [
          it(List,       'Liste des boutiques'),
          it(PlusCircle, 'Ajouter une boutique'),
        ],
      },
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

// ── Props ────────────────────────────────────────────────────
interface SidebarProps {
  activeItem?:  string
  boutiqueName?: string
  onItemClick?: (label: string) => void
}

// ── Component ────────────────────────────────────────────────
export default function Sidebar({ activeItem, boutiqueName, onItemClick }: SidebarProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({ Commandes: true })

  function toggle(label: string) {
    setOpen(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function hasActiveChild(children: ChildItem[]): boolean {
    return children.some(c => c.type !== 'section' && c.label === activeItem)
  }

  return (
    <nav style={{
      width: 234,
      minWidth: 234,
      background: D.bg,
      borderRight: `1px solid ${D.border}`,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* ── Brand header ── */}
      <div style={{
        padding: '16px 14px 15px',
        background: D.headerBg,
        borderBottom: `1px solid ${D.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Logo tile */}
          <div style={{
            width: 38, height: 38,
            background: 'linear-gradient(135deg, #BF4C98 0%, #7B1E5A 100%)',
            borderRadius: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 14px rgba(191,76,152,0.45)',
          }}>
            <ShoppingBag size={19} color="#fff" strokeWidth={1.8} />
          </div>

          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: 16, fontWeight: 800, color: '#fff',
              letterSpacing: '-0.4px', lineHeight: 1.15,
            }}>
              chic<span style={{ color: '#E891CF' }}>N</span>
            </div>
            <div style={{
              fontSize: 11, color: D.textDim, marginTop: 2,
              fontWeight: 400, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {boutiqueName || 'Tableau de bord'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div style={{ flex: 1, paddingTop: 8, paddingBottom: 24, overflowY: 'auto' }}>
        {SECTIONS.map((section, si) => (
          <div key={si}>

            {/* Top-level section label */}
            {section.sectionLabel && (
              <div style={{
                padding: '10px 18px 4px',
                fontSize: 10, fontWeight: 700,
                color: D.sectionLabel,
                textTransform: 'uppercase',
                letterSpacing: '1.2px',
                marginTop: 6,
              }}>
                {section.sectionLabel}
              </div>
            )}

            {section.groups.map(({ icon: Icon, label, badge, children }) => {
              const isOpen       = !!open[label]
              const childActive  = hasActiveChild(children)
              const isParentActive = activeItem === label

              return (
                <div key={label}>

                  {/* ── Parent row ── */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => { toggle(label); onItemClick?.(label) }}
                    onKeyDown={e => e.key === 'Enter' && toggle(label)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      margin: '1px 8px',
                      padding: '8px 10px 8px 12px',
                      borderRadius: 9,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: childActive ? 600 : 500,
                      color: isParentActive
                        ? '#fff'
                        : childActive
                          ? '#fff'
                          : D.text,
                      background: isParentActive
                        ? D.primary
                        : childActive
                          ? D.primaryBg
                          : 'transparent',
                      userSelect: 'none',
                      transition: 'background .12s',
                      borderLeft: childActive && !isParentActive
                        ? `3px solid ${D.primary}`
                        : isParentActive
                          ? '3px solid transparent'
                          : '3px solid transparent',
                    }}
                    onMouseEnter={e => {
                      if (!isParentActive && !childActive)
                        (e.currentTarget as HTMLDivElement).style.background = D.hover
                    }}
                    onMouseLeave={e => {
                      if (!isParentActive && !childActive)
                        (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      {/* Icon tile */}
                      <div style={{
                        width: 26, height: 26,
                        borderRadius: 7,
                        background: isParentActive
                          ? 'rgba(255,255,255,0.2)'
                          : childActive
                            ? `rgba(191,76,152,0.25)`
                            : 'rgba(255,255,255,0.07)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'background .12s',
                      }}>
                        <Icon
                          size={13}
                          strokeWidth={isParentActive || childActive ? 2.2 : 1.8}
                          color={isParentActive ? '#fff' : childActive ? D.primary : D.icon}
                        />
                      </div>

                      <span>{label}</span>

                      {badge && (
                        <span style={{
                          background: badge === 'new' ? D.newBadge : D.badgeBg,
                          color: badge === 'new' ? '#fff' : D.badgeFg,
                          borderRadius: 5, padding: '1px 6px',
                          fontSize: 9, fontWeight: 700, letterSpacing: '0.5px',
                        }}>
                          {badge.toUpperCase()}
                        </span>
                      )}
                    </div>

                    {isOpen
                      ? <ChevronDown  size={11} color={isParentActive ? 'rgba(255,255,255,0.7)' : D.textDim} />
                      : <ChevronRight size={11} color={D.textDim} />
                    }
                  </div>

                  {/* ── Children ── */}
                  {isOpen && (
                    <div style={{ paddingBottom: 3 }}>
                      {children.map((child, idx) => {

                        /* Section separator within children */
                        if (child.type === 'section') {
                          return (
                            <div key={`sec-${idx}`} style={{
                              padding: '7px 14px 3px 46px',
                              fontSize: 9.5, fontWeight: 700,
                              color: D.childSec,
                              textTransform: 'uppercase',
                              letterSpacing: '0.9px',
                              borderTop: idx === 0 ? 'none' : `1px solid ${D.border}`,
                              marginTop: idx === 0 ? 2 : 6,
                            }}>
                              {child.label}
                            </div>
                          )
                        }

                        const isChildActive = activeItem === child.label
                        const CIcon = (child as { icon?: React.ElementType }).icon

                        return (
                          <div
                            key={child.label}
                            role="button"
                            tabIndex={0}
                            onClick={() => onItemClick?.(child.label)}
                            onKeyDown={e => e.key === 'Enter' && onItemClick?.(child.label)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              margin: '1px 8px 1px 22px',
                              padding: '5.5px 10px 5.5px 20px',
                              borderRadius: 7,
                              cursor: 'pointer',
                              fontSize: 12,
                              color: isChildActive ? D.primaryFg : D.textDim,
                              fontWeight: isChildActive ? 600 : 400,
                              background: isChildActive
                                ? 'rgba(191,76,152,0.16)'
                                : 'transparent',
                              borderLeft: `2px solid ${isChildActive ? D.primary : 'transparent'}`,
                              userSelect: 'none',
                              transition: 'background .1s, color .1s',
                            }}
                            onMouseEnter={e => {
                              if (!isChildActive)
                                (e.currentTarget as HTMLDivElement).style.background = D.hover
                            }}
                            onMouseLeave={e => {
                              if (!isChildActive)
                                (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                            }}
                          >
                            {CIcon && (
                              <CIcon
                                size={11}
                                strokeWidth={isChildActive ? 2.2 : 1.8}
                                color={isChildActive ? D.primary : 'rgba(255,255,255,0.28)'}
                              />
                            )}
                            <span>{child.label}</span>
                          </div>
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
        padding: '10px 14px 12px',
        borderTop: `1px solid ${D.border}`,
        flexShrink: 0,
        fontSize: 10.5,
        color: D.textDim,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: '#2ECC71', flexShrink: 0,
        }} />
        Connecté · chicN V2.41
      </div>
    </nav>
  )
}
