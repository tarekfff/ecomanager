'use client'
import { useRouter } from 'next/navigation'
import { ShoppingCart, Package, Truck, UserCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageHeader, Button } from '@/components/ui'
import { colors, fonts } from '@/lib/tokens'

interface ReportCardDef {
  icon: LucideIcon
  key:  'orders' | 'products' | 'livreurs' | 'confirmateurs'
  href: string
}

const REPORT_DEFS: ReportCardDef[] = [
  { icon: ShoppingCart, key: 'orders',        href: '/dashboard/stats/boutique'    },
  { icon: Package,      key: 'products',      href: '/dashboard/stats/produit'     },
  { icon: Truck,        key: 'livreurs',      href: '/dashboard/stats/livreur'     },
  { icon: UserCheck,    key: 'confirmateurs', href: '/dashboard/stats/confirmateur'},
]

export default function RapportsPage() {
  const router = useRouter()
  const { t } = useTranslation('accounting')

  return (
    <>
      <PageHeader title={t('rapports.title')} subtitle={t('rapports.subtitle')} />

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
          maxWidth: 920,
        }}>
          {REPORT_DEFS.map(({ icon: Icon, key, href }) => (
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
                <h3 style={{ fontSize: 14, fontWeight: 600, color: colors.text, margin: '0 0 4px' }}>
                  {t(`rapports.cards.${key}.title`)}
                </h3>
                <p style={{ fontSize: 12.5, color: colors.textMd, margin: 0, lineHeight: 1.5 }}>
                  {t(`rapports.cards.${key}.description`)}
                </p>
              </div>

              <div>
                <Button variant="secondary" size="sm" onClick={() => router.push(href)}>
                  {t('rapports.viewBtn')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
