'use client'

import { ReactNode } from 'react'
import { colors, fonts } from '@/lib/tokens'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div style={{
      background: '#fff',
      borderBottom: `1px solid ${colors.border}`,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontFamily: fonts.sans,
    }}>
      <div>
        <h1 style={{
          fontSize: 15,
          fontWeight: 600,
          color: colors.text,
          margin: 0,
          lineHeight: 1.3,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            fontSize: 12,
            color: colors.textMd,
            margin: '2px 0 0',
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
