'use client'

import { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { colors, fonts } from '@/lib/tokens'
import Button from './Button'

interface EmptyStateProps {
  /** Lucide icon component (e.g. Users, Package). Defaults to Inbox. */
  icon?:     React.ElementType
  title:     string
  message?:  string
  /** Optional primary action — renders a Button when provided. */
  actionLabel?: string
  onAction?: () => void
  /** Escape hatch for a custom action area instead of a single button. */
  action?:   ReactNode
}

/** Centered empty-state for list/table pages: icon bubble + message + CTA.
 *  Example:
 *    <EmptyState icon={Users} title="Aucun client trouvé"
 *      actionLabel="Ajouter le premier client" onAction={openAdd} /> */
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  actionLabel,
  onAction,
  action,
}: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '56px 24px', gap: 6, fontFamily: fonts.sans,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: colors.primaryLt,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 6,
      }}>
        <Icon size={28} color={colors.primary} strokeWidth={1.7} />
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{title}</div>

      {message && (
        <div style={{ fontSize: 13, color: colors.textLt, maxWidth: 360, lineHeight: 1.45 }}>
          {message}
        </div>
      )}

      {action ?? (actionLabel && onAction && (
        <div style={{ marginTop: 12 }}>
          <Button variant="primary" size="sm" onClick={onAction}>{actionLabel}</Button>
        </div>
      ))}
    </div>
  )
}
