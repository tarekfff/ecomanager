'use client'

import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { colors, fonts } from '@/lib/tokens'

const MAX_WIDTHS = { sm: 400, md: 600, lg: 900 } as const

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 6,
          width: '100%',
          maxWidth: MAX_WIDTHS[size],
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: fonts.sans,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: `1px solid ${colors.border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textMd,
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
