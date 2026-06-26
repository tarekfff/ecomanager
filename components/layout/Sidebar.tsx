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
  PackageX, FilePlus, Search, BookOpen,
} from 'lucide-react'

// ── Design tokens ──────────────────────────────────────────
const C = {
  pink:      '#BF4C98',
  pinkLt:    '#F5E0EF',
  border:    '#E8E0E8',
  text:      '#555555',
  textLt:    '#888888',
  orange:    '#ff9800',
  bg:        '#FFF7F2',
  sectionBg: '#F8F4F8',
}

// ── Types ──────────────────────────────────────────────────
type ChildItem =
  | { type?: 'item'; icon?: React.ElementType; label: string }
  | { type: 'section'; label: string }

interface NavGroup {
  icon: React.ElementType
  label: string
  badge?: string
  children: ChildItem[]
}

// ── Section divider helper ─────────────────────────────────
const sec = (label: string): ChildItem => ({ type: 'section', label })
const it  = (icon: React.ElementType, label: string): ChildItem => ({ icon, label })

// ── Navigation definition (from PDF plan) ─────────────────
const NAV: NavGroup[] = [
  {
    icon: ShoppingCart, label: 'Commandes',
    children: [
      it(FilePlus,      'Nouvelle commande'),
      it(Upload,        'Import Google Sheet'),
      sec('Archives'),
      it(Archive,       'Encaissées'),
      it(Archive,       'Retournées'),
      it(Archive,       'Annulées'),
      it(Trash2,        'Corbeille'),
      sec('Bons'),
      it(Receipt,       "Bon d'encaissement"),
      it(RotateCcw,     'Bon de retour'),
      sec('Pickups'),
      it(Truck,         'En collecte'),
      it(Package,       'Collecté'),
      it(PackageCheck,  'Reçus'),
      it(PackageCheck,  'Traités'),
      it(PackageX,      'Annulés'),
    ],
  },
  {
    icon: Users, label: 'Clients',
    children: [
      it(List,         'Liste des clients'),
      it(PlusCircle,   'Ajouter un client'),
      it(Upload,       'Import en masse'),
      it(Search,       'Rechercher un client'),
    ],
  },
  {
    icon: Package, label: 'Produits',
    children: [
      it(List,         'Liste des produits'),
      it(PlusCircle,   'Ajouter un produit'),
      it(Upload,       'Import en masse'),
      it(Tag,          'Options & attributs'),
    ],
  },
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
      it(List,        'Liste des marques'),
      it(PlusCircle,  'Ajouter une marque'),
    ],
  },
  {
    icon: Building2, label: 'Fournisseurs',
    children: [
      it(List,        'Liste des fournisseurs'),
      it(PlusCircle,  'Ajouter un fournisseur'),
    ],
  },
  {
    icon: Truck, label: 'Livraison',
    children: [
      it(List,        'Liste des livreurs'),
      it(PlusCircle,  'Ajouter un livreur'),
    ],
  },
  {
    icon: BarChart2, label: 'Statistiques V2', badge: 'new',
    children: [
      it(Store,        'Par boutique'),
      it(Package,      'Par produit'),
      it(UserCog,      'Par confirmateur'),
      it(Truck,        'Par livreur'),
      it(BookOpen,     'Par wilaya'),
    ],
  },
  {
    icon: Banknote, label: 'Comptabilité',
    children: [
      it(FileText,    'Bilan général'),
      it(TrendingUp,  'Rentabilité produit'),
      it(CreditCard,  'Saisir des dépenses'),
      it(Megaphone,   'Coûts publicitaires'),
    ],
  },
  {
    icon: Database, label: 'Données',
    children: [
      it(Download,    'Exporter les données'),
      it(BarChart2,   'Rapports'),
    ],
  },
  {
    icon: Zap, label: 'Webhooks',
    children: [
      it(List,        'Liste des webhooks'),
      it(PlusCircle,  'Ajouter un webhook'),
      it(FileText,    'Logs des webhooks'),
    ],
  },
  {
    icon: Shield, label: 'Modérateurs',
    children: [
      it(Users,       'Gestion des utilisateurs'),
      it(Shield,      'Rôles & permissions'),
    ],
  },
  {
    icon: Store, label: 'Boutiques',
    children: [
      it(List,        'Liste des boutiques'),
      it(PlusCircle,  'Ajouter une boutique'),
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
]

// ── Props ──────────────────────────────────────────────────
interface SidebarProps {
  activeItem?: string
  onItemClick?: (label: string) => void
}

// ── Component ──────────────────────────────────────────────
export default function Sidebar({ activeItem, onItemClick }: SidebarProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({ Commandes: true })

  function toggle(label: string) {
    setOpen(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <nav style={{
      width: 220,
      background: '#fff',
      borderRight: `1px solid ${C.border}`,
      flexShrink: 0,
      overflowY: 'auto',
      paddingBottom: 24,
    }}>
      {NAV.map(({ icon: Icon, label, badge, children }) => {
        const isOpen   = !!open[label]
        const isActive = activeItem === label

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
                padding: '8px 12px 8px 11px',
                cursor: 'pointer',
                fontSize: 12.5,
                fontWeight: 500,
                color: isActive ? C.pink : C.text,
                background: isActive ? C.pinkLt : 'transparent',
                borderLeft: `3px solid ${isActive ? C.pink : 'transparent'}`,
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon
                  size={14}
                  strokeWidth={1.8}
                  style={{ flexShrink: 0, color: isActive ? C.pink : C.text }}
                />
                <span>{label}</span>
                {badge && (
                  <span style={{
                    background: C.orange, color: '#fff',
                    borderRadius: 3, padding: '0 5px',
                    fontSize: 9, fontWeight: 700,
                  }}>
                    {badge}
                  </span>
                )}
              </div>
              {isOpen
                ? <ChevronDown  size={11} color={C.textLt} />
                : <ChevronRight size={11} color={C.textLt} />
              }
            </div>

            {/* ── Children ── */}
            {isOpen && (
              <div style={{
                background: C.sectionBg,
                borderBottom: `1px solid ${C.border}`,
              }}>
                {children.map((child, idx) => {
                  // Section separator
                  if (child.type === 'section') {
                    return (
                      <div key={`sec-${idx}`} style={{
                        padding: '5px 12px 3px 14px',
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.textLt,
                        textTransform: 'uppercase',
                        letterSpacing: '0.6px',
                        marginTop: idx === 0 ? 0 : 4,
                        borderTop: idx === 0 ? 'none' : `1px solid ${C.border}`,
                      }}>
                        {child.label}
                      </div>
                    )
                  }

                  // Regular item
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
                        gap: 7,
                        padding: '5px 12px 5px 28px',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: isChildActive ? C.pink : C.text,
                        fontWeight: isChildActive ? 600 : 400,
                        background: isChildActive ? C.pinkLt : 'transparent',
                        borderLeft: `3px solid ${isChildActive ? C.pink : 'transparent'}`,
                        userSelect: 'none',
                        transition: 'background .1s',
                      }}
                      onMouseEnter={e => {
                        if (!isChildActive)
                          (e.currentTarget as HTMLDivElement).style.background = '#EFE8EF'
                      }}
                      onMouseLeave={e => {
                        if (!isChildActive)
                          (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                      }}
                    >
                      {CIcon && (
                        <CIcon
                          size={12}
                          strokeWidth={1.8}
                          style={{ flexShrink: 0, color: isChildActive ? C.pink : C.textLt }}
                        />
                      )}
                      {child.label}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
