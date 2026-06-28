'use client'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Package, Truck, UserCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader, Button } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

// ── Report cards ───────────────────────────────────────────────────────────

interface ReportCard {
  icon:        LucideIcon
  title:       string
  description: string
  href:        string
}

const REPORTS: ReportCard[] = [
  {
    icon: ShoppingCart,
    title: 'Rapport des commandes',
    description: 'Vue d’ensemble des commandes par boutique : volumes, statuts et chiffre d’affaires.',
    href: '/dashboard/stats/boutique',
  },
  {
    icon: Package,
    title: 'Rapport des produits',
    description: 'Performances des produits : quantités vendues, revenus et taux de retour.',
    href: '/dashboard/stats/produit',
  },
  {
    icon: Truck,
    title: 'Rapport des livreurs',
    description: 'Activité par livreur : commandes livrées, retours et taux de réussite.',
    href: '/dashboard/stats/livreur',
  },
  {
    icon: UserCheck,
    title: 'Rapport des confirmateurs',
    description: 'Activité par confirmateur : commandes confirmées, annulées et performance.',
    href: '/dashboard/stats/confirmateur',
  },
]

// ── Page ───────────────────────────────────────────────────────────────────

export default function RapportsPage() {
  const router = useRouter()

  return (
    <>
      <PageHeader
        title="Rapports"
        subtitle="Accédez aux rapports détaillés de votre activité"
      />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
          maxWidth: 920,
        }}>
          {REPORTS.map(({ icon: Icon, title, description, href }) => (
            <div
              key={href}
              style={{
                background: '#fff',
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                fontFamily: fonts.sans,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 8,
                background: colors.primaryLt, color: colors.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} />
              </div>

              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: 14, fontWeight: 600, color: colors.text, margin: '0 0 4px',
                }}>
                  {title}
                </h3>
                <p style={{
                  fontSize: 12.5, color: colors.textMd, margin: 0, lineHeight: 1.5,
                }}>
                  {description}
                </p>
              </div>

              <div>
                <Button variant="secondary" size="sm" onClick={() => router.push(href)}>
                  Voir le rapport
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
