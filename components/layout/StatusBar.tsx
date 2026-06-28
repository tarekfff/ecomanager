'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useBoutique } from '@/contexts/BoutiqueContext'
import { colors, fonts } from '@/lib/tokens'
import { getStoredToken } from '@/lib/client-auth'
import { Skeleton } from '@/components/ui'

export interface OrderCounts {
  en_confirmation: number
  en_preparation:  number
  en_dispatch:     number
  en_livraison:    number
  livree:          number
  en_retour:       number
}

const ZERO: OrderCounts = {
  en_confirmation: 0, en_preparation: 0, en_dispatch: 0,
  en_livraison: 0, livree: 0, en_retour: 0,
}

const PIPELINE: Array<{ label: string; path: string; dot: string; key: keyof OrderCounts }> = [
  { label: 'En confirmation', path: '/dashboard/orders/en-confirmation', dot: '#4472C4', key: 'en_confirmation' },
  { label: 'En préparation',  path: '/dashboard/orders/en-preparation',  dot: '#9966CC', key: 'en_preparation'  },
  { label: 'En dispatch',     path: '/dashboard/orders/en-dispatch',      dot: '#E6B800', key: 'en_dispatch'     },
  { label: 'En livraison',    path: '/dashboard/orders/en-livraison',     dot: '#888888', key: 'en_livraison'    },
  { label: 'Livrées',         path: '/dashboard/orders/livrees',          dot: '#00B0A0', key: 'livree'          },
  { label: 'En retour',       path: '/dashboard/orders/en-retour',        dot: '#E84B6A', key: 'en_retour'       },
]

interface StatusBarProps {
  orderCounts?: OrderCounts
}

export default function StatusBar({ orderCounts }: StatusBarProps) {
  const router           = useRouter()
  const pathname         = usePathname()
  const { boutiqueId }   = useBoutique()
  const [counts,  setCounts]  = useState<OrderCounts>(orderCounts ?? ZERO)
  const [loading, setLoading] = useState(!orderCounts)

  useEffect(() => {
    if (orderCounts) { setCounts(orderCounts); setLoading(false); return }
    if (!boutiqueId) return
    const token = getStoredToken()
    if (!token) return
    setLoading(true)
    fetch(`/api/dashboard/stats?boutiqueId=${boutiqueId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { if (data.counts) setCounts(data.counts) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boutiqueId, orderCounts])

  return (
    <div style={{
      height: 38,
      background: '#fff',
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'stretch',
      padding: '0 4px',
      flexShrink: 0,
      overflowX: 'auto',
      fontFamily: fonts.sans,
    }}>
      {PIPELINE.map(({ label, path, dot, key }) => {
        const isActive = pathname === path || pathname.startsWith(path + '/')
        const count    = counts[key]
        return (
          <button
            key={path}
            onClick={() => router.push(path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 11px', height: '100%',
              border: 'none',
              borderBottom: isActive ? `2px solid ${colors.primary}` : '2px solid transparent',
              background: 'transparent',
              color: isActive ? colors.primary : colors.textMd,
              fontWeight: isActive ? 600 : 400,
              fontSize: 12, cursor: 'pointer',
              fontFamily: fonts.sans, whiteSpace: 'nowrap',
              transition: 'color .1s, border-color .1s',
            }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = colors.text
            }}
            onMouseLeave={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = colors.textMd
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: dot, flexShrink: 0,
              opacity: isActive ? 1 : 0.6,
            }} />
            {label}
            {loading ? (
              <Skeleton width={20} height={16} radius={10} />
            ) : count > 0 && (
              <span style={{
                background: isActive ? colors.primary : '#eee',
                color: isActive ? '#fff' : colors.textMd,
                borderRadius: 10, padding: '1px 6px',
                fontSize: 10.5, fontWeight: 600, lineHeight: '16px',
              }}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
