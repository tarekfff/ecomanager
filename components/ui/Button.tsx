'use client'

import { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { colors, fonts } from '@/lib/tokens'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

interface ButtonProps {
  variant?: Variant
  size?: Size
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  loading?: boolean
}

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  primary:   { background: colors.primary, color: '#fff', border: `1px solid ${colors.primary}` },
  secondary: { background: '#fff', color: colors.text, border: `1px solid ${colors.border}` },
  danger:    { background: '#dc3545', color: '#fff', border: '1px solid #dc3545' },
  ghost:     { background: 'transparent', color: colors.textMd, border: '1px solid transparent' },
}

const HOVER_BG: Record<Variant, string> = {
  primary:   colors.primaryDk,
  secondary: '#f5f5f5',
  danger:    '#c82333',
  ghost:     '#f0f0f0',
}

const SIZE_STYLES: Record<Size, React.CSSProperties> = {
  sm: { padding: '5px 10px', fontSize: 12 },
  md: { padding: '7px 14px', fontSize: 13 },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  disabled = false,
  type = 'button',
  loading = false,
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={(e) => {
        if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.background = HOVER_BG[variant]
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.background = VARIANT_STYLES[variant].background as string
      }}
      style={{
        ...VARIANT_STYLES[variant],
        ...SIZE_STYLES[size],
        fontFamily: fonts.sans,
        fontWeight: 500,
        borderRadius: 5,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background 0.15s',
        lineHeight: 1,
      }}
    >
      {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
      {children}
    </button>
  )
}
