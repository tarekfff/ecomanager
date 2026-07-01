'use client'

import { useTranslation } from 'react-i18next'
import { colors, fonts } from '@/lib/tokens'

export interface StatsFiltersValue {
  boutiqueId:  string
  base:        'all' | 'confirmed'
  dateField:   string
  from:        string
  to:          string
  resultBy:    'count' | 'quantity'
  displayMode: 'number' | 'percent'
}

interface Boutique { id: string; name: string }

interface StatsFiltersProps {
  value:     StatsFiltersValue
  onChange:  (v: StatsFiltersValue) => void
  boutiques: Boutique[]
}

export default function StatsFilters({ value, onChange, boutiques }: StatsFiltersProps) {
  const { t } = useTranslation('stats')

  function set(patch: Partial<StatsFiltersValue>) {
    onChange({ ...value, ...patch })
  }

  const DATE_FIELD_OPTIONS = [
    { value: 'created',    label: t('filters.dateFields.created')    },
    { value: 'assigned',   label: t('filters.dateFields.assigned')   },
    { value: 'confirmed',  label: t('filters.dateFields.confirmed')  },
    { value: 'dispatched', label: t('filters.dateFields.dispatched') },
    { value: 'shipped',    label: t('filters.dateFields.shipped')    },
    { value: 'delivered',  label: t('filters.dateFields.delivered')  },
    { value: 'failed',     label: t('filters.dateFields.failed')     },
    { value: 'paid',       label: t('filters.dateFields.paid')       },
    { value: 'returned',   label: t('filters.dateFields.returned')   },
    { value: 'cancelled',  label: t('filters.dateFields.cancelled')  },
  ]

  return (
    <div style={{
      background: '#fff',
      borderBottom: `1px solid ${colors.border}`,
      padding: '10px 16px',
      fontFamily: fonts.sans,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>

        {/* Boutique */}
        <div style={{ minWidth: 160 }}>
          <label style={labelSt}>{t('filters.boutique')}</label>
          <select
            value={value.boutiqueId}
            onChange={e => set({ boutiqueId: e.target.value })}
            style={selSt}
          >
            <option value="">{t('filters.allBoutiques')}</option>
            {boutiques.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Basé sur */}
        <div style={{ minWidth: 190 }}>
          <label style={labelSt}>{t('filters.basedOn')}</label>
          <select
            value={value.base}
            onChange={e => set({ base: e.target.value as 'all' | 'confirmed' })}
            style={selSt}
          >
            <option value="all">{t('filters.allOrders')}</option>
            <option value="confirmed">{t('filters.confirmedOnly')}</option>
          </select>
        </div>

        {/* Filtrer selon */}
        <div style={{ minWidth: 210 }}>
          <label style={labelSt}>{t('filters.dateField')}</label>
          <select
            value={value.dateField}
            onChange={e => set({ dateField: e.target.value })}
            style={selSt}
          >
            {DATE_FIELD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <div>
            <label style={labelSt}>{t('filters.periodFrom')}</label>
            <input
              type="date"
              value={value.from}
              onChange={e => set({ from: e.target.value })}
              style={inputSt}
            />
          </div>
          <span style={{ fontSize: 12, color: colors.textLt, paddingBottom: 8 }}>–</span>
          <div>
            <label style={labelSt}>{t('filters.to')}</label>
            <input
              type="date"
              value={value.to}
              onChange={e => set({ to: e.target.value })}
              style={inputSt}
            />
          </div>
        </div>

        {/* Résultat par */}
        <div>
          <label style={labelSt}>{t('filters.resultBy')}</label>
          <div style={{ display: 'flex', gap: 16, height: 30, alignItems: 'center' }}>
            {(['count', 'quantity'] as const).map(val => (
              <label key={val} style={radioLabel}>
                <input
                  type="radio"
                  checked={value.resultBy === val}
                  onChange={() => set({ resultBy: val })}
                  style={{ accentColor: colors.primary }}
                />
                {val === 'count' ? t('filters.byCount') : t('filters.byQty')}
              </label>
            ))}
          </div>
        </div>

        {/* Affichage */}
        <div>
          <label style={labelSt}>{t('filters.display')}</label>
          <div style={{ display: 'flex', gap: 16, height: 30, alignItems: 'center' }}>
            {(['number', 'percent'] as const).map(val => (
              <label key={val} style={radioLabel}>
                <input
                  type="radio"
                  checked={value.displayMode === val}
                  onChange={() => set({ displayMode: val })}
                  style={{ accentColor: colors.primary }}
                />
                {val === 'number' ? t('filters.inNumber') : t('filters.inPercent')}
              </label>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

const labelSt: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: colors.textMd,
  marginBottom: 3,
  fontWeight: 500,
}

const selSt: React.CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: 4,
  padding: '6px 8px',
  fontSize: 12.5,
  fontFamily: fonts.sans,
  color: colors.text,
  background: '#fff',
  outline: 'none',
  cursor: 'pointer',
  width: '100%',
}

const inputSt: React.CSSProperties = {
  border: `1px solid ${colors.border}`,
  borderRadius: 4,
  padding: '6px 8px',
  fontSize: 12.5,
  fontFamily: fonts.sans,
  color: colors.text,
  background: '#fff',
  outline: 'none',
}

const radioLabel: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12.5,
  color: colors.text,
  cursor: 'pointer',
}
