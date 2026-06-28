'use client'
import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { usePermissions } from '@/contexts/PermissionsContext'
import { requiredPermForPath } from '@/lib/permission-maps'
import { colors, fonts } from '@/lib/tokens'
import { ShieldAlert } from 'lucide-react'

/**
 * Blocks rendering of a dashboard page when the current user lacks the
 * permission mapped to its route. This is the UI half of RBAC — the API routes
 * enforce the same rules server-side, so this is purely to avoid showing a page
 * the user can't use (and to give a clear message instead of empty 403 states).
 */
export default function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { canAny, ready } = usePermissions()

  // Until permissions load, render nothing to avoid a flash of forbidden content.
  if (!ready) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: colors.textLt, fontFamily: fonts.sans, fontSize: 13,
      }}>
        Chargement…
      </div>
    )
  }

  const required = requiredPermForPath(pathname)
  if (required && !canAny(required)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 14, fontFamily: fonts.sans, padding: 24, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, background: colors.primaryLt,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldAlert size={28} color={colors.primary} strokeWidth={1.8} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>
          Accès refusé
        </div>
        <div style={{ fontSize: 13.5, color: colors.textMd, maxWidth: 380, lineHeight: 1.5 }}>
          Vous n’avez pas la permission d’accéder à cette page. Contactez un
          administrateur si vous pensez qu’il s’agit d’une erreur.
        </div>
      </div>
    )
  }

  return <>{children}</>
}
