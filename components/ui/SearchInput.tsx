'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { colors, fonts } from '@/lib/tokens'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function SearchInput({ value, onChange, placeholder = 'Rechercher…' }: SearchInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <Search
        size={14}
        style={{
          position: 'absolute',
          left: 9,
          color: colors.textLt,
          pointerEvents: 'none',
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          border: `1px solid ${focused ? colors.primary : colors.border}`,
          borderRadius: 4,
          padding: '6px 10px 6px 30px',
          fontSize: 13,
          color: colors.text,
          fontFamily: fonts.sans,
          outline: 'none',
          background: '#fff',
          transition: 'border-color 0.15s',
          width: 220,
        }}
      />
    </div>
  )
}
