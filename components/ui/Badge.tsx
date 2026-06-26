'use client'

import { ReactNode } from 'react'
import { fonts } from '@/lib/tokens'

type BadgeColor = 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'gray'

interface BadgeProps {
  color: BadgeColor
  children: ReactNode
}

const COLOR_MAP: Record<BadgeColor, { bg: string; text: string }> = {
  green:  { bg: '#d4edda', text: '#155724' },
  red:    { bg: '#f8d7da', text: '#721c24' },
  orange: { bg: '#fff3cd', text: '#856404' },
  blue:   { bg: '#d1ecf1', text: '#0c5460' },
  purple: { bg: '#e8d5f5', text: '#5a2d82' },
  gray:   { bg: '#e9ecef', text: '#495057' },
}

export default function Badge({ color, children }: BadgeProps) {
  const { bg, text } = COLOR_MAP[color]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: 11,
      fontWeight: 600,
      fontFamily: fonts.sans,
      background: bg,
      color: text,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}
