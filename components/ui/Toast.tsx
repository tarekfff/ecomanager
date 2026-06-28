'use client'

import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { colors, fonts } from '@/lib/tokens'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id:       string
  variant:  ToastVariant
  message:  string
  /** Optional bold title shown above the message. */
  title?:   string
  /** True while the exit animation plays — used to slide it out. */
  leaving?: boolean
}

const VARIANTS: Record<ToastVariant, { icon: React.ElementType; color: string; bg: string }> = {
  success: { icon: CheckCircle2,  color: colors.green,  bg: '#f0fdf4' },
  error:   { icon: XCircle,       color: colors.red,    bg: '#fef2f2' },
  warning: { icon: AlertTriangle, color: colors.orange, bg: '#fffbeb' },
  info:    { icon: Info,          color: colors.blue,   bg: '#eff6ff' },
}

/** A single toast card. Visual only — lifecycle is owned by ToastProvider. */
export function Toast({ toast, onClose }: { toast: ToastItem; onClose: (id: string) => void }) {
  const { icon: Icon, color, bg } = VARIANTS[toast.variant]
  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        width: 320, maxWidth: '90vw',
        padding: '11px 12px',
        background: bg,
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 8,
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        fontFamily: fonts.sans,
        animation: `${toast.leaving ? 'toast-out' : 'toast-in'} 0.22s ease-out forwards`,
      }}
    >
      <Icon size={18} color={color} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 1 }}>
            {toast.title}
          </div>
        )}
        <div style={{ fontSize: 12.5, color: colors.textMd, lineHeight: 1.4, wordBreak: 'break-word' }}>
          {toast.message}
        </div>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        aria-label="Fermer"
        style={{
          flexShrink: 0, background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 2, color: colors.textLt, display: 'flex', borderRadius: 4,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = colors.text)}
        onMouseLeave={e => (e.currentTarget.style.color = colors.textLt)}
      >
        <X size={15} />
      </button>
    </div>
  )
}

/** Fixed top-right stack of toasts. */
export function ToastContainer({ toasts, onClose }: { toasts: ToastItem[]; onClose: (id: string) => void }) {
  return (
    <div style={{
      position: 'fixed', top: 14, right: 14, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <Toast toast={t} onClose={onClose} />
        </div>
      ))}
    </div>
  )
}
