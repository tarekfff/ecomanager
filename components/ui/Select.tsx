'use client'

import { useState } from 'react'
import { colors, fonts } from '@/lib/tokens'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  error?: string
  disabled?: boolean
}

export default function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled = false,
}: SelectProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', fontFamily: fonts.sans }}>
      {label && (
        <label style={{
          fontSize: 12.5,
          color: disabled ? colors.textLt : colors.textMd,
          marginBottom: 4,
          fontWeight: 500,
        }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        style={{
          width: '100%',
          border: `1px solid ${error ? '#dc3545' : focused ? colors.primary : colors.border}`,
          borderRadius: 4,
          padding: '7px 10px',
          fontSize: 13,
          color: value ? colors.text : colors.textLt,
          fontFamily: fonts.sans,
          outline: 'none',
          background: disabled ? '#f7f7f7' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.65 : 1,
          appearance: 'auto',
          transition: 'border-color 0.15s',
          boxSizing: 'border-box',
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span style={{ fontSize: 11, color: '#dc3545', marginTop: 3 }}>
          {error}
        </span>
      )}
    </div>
  )
}
