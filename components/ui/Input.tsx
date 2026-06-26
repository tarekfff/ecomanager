'use client'

import { ReactNode, useState } from 'react'
import { colors, fonts } from '@/lib/tokens'

interface InputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  error?: string
  icon?: ReactNode
  required?: boolean
}

export default function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  icon,
  required,
}: InputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', fontFamily: fonts.sans }}>
      {label && (
        <label style={{
          fontSize: 12.5,
          color: colors.textMd,
          marginBottom: 4,
          fontWeight: 500,
        }}>
          {label}{required && <span style={{ color: colors.primary, marginLeft: 2 }}>*</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{
            position: 'absolute',
            left: 9,
            top: '50%',
            transform: 'translateY(-50%)',
            color: colors.textLt,
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'none',
          }}>
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            border: `1px solid ${error ? '#dc3545' : focused ? colors.primary : colors.border}`,
            borderRadius: 4,
            padding: icon ? '7px 10px 7px 30px' : '7px 10px',
            fontSize: 13,
            color: colors.text,
            fontFamily: fonts.sans,
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
            background: '#fff',
          }}
        />
      </div>
      {error && (
        <span style={{ fontSize: 11, color: '#dc3545', marginTop: 3 }}>
          {error}
        </span>
      )}
    </div>
  )
}
