'use client'

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

const DATE_FIELD_OPTIONS = [
  { value: 'created',    label: 'Date de création' },
  { value: 'assigned',   label: "Date d'affectation" },
  { value: 'confirmed',  label: 'Date de confirmation' },
  { value: 'dispatched', label: 'Date de dispatch' },
  { value: 'shipped',    label: "Date d'expédition" },
  { value: 'delivered',  label: 'Date de livraison' },
  { value: 'failed',     label: "Date d'échec" },
  { value: 'paid',       label: "Date d'encaissement" },
  { value: 'returned',   label: 'Date de retour' },
  { value: 'cancelled',  label: "Date d'annulation" },
]

export default function StatsFilters({ value, onChange, boutiques }: StatsFiltersProps) {
  function set(patch: Partial<StatsFiltersValue>) {
    onChange({ ...value, ...patch })
  }

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
          <label style={labelSt}>Boutique</label>
          <select
            value={value.boutiqueId}
            onChange={e => set({ boutiqueId: e.target.value })}
            style={selSt}
          >
            <option value="">Toutes les boutiques</option>
            {boutiques.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Basé sur */}
        <div style={{ minWidth: 190 }}>
          <label style={labelSt}>Basé sur</label>
          <select
            value={value.base}
            onChange={e => set({ base: e.target.value as 'all' | 'confirmed' })}
            style={selSt}
          >
            <option value="all">Toutes les commandes</option>
            <option value="confirmed">Confirmées uniquement</option>
          </select>
        </div>

        {/* Filtrer selon */}
        <div style={{ minWidth: 210 }}>
          <label style={labelSt}>Filtrer selon</label>
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
            <label style={labelSt}>Période De</label>
            <input
              type="date"
              value={value.from}
              onChange={e => set({ from: e.target.value })}
              style={inputSt}
            />
          </div>
          <span style={{ fontSize: 12, color: colors.textLt, paddingBottom: 8 }}>–</span>
          <div>
            <label style={labelSt}>À</label>
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
          <label style={labelSt}>Résultat par</label>
          <div style={{ display: 'flex', gap: 16, height: 30, alignItems: 'center' }}>
            {(['count', 'quantity'] as const).map(val => (
              <label key={val} style={radioLabel}>
                <input
                  type="radio"
                  checked={value.resultBy === val}
                  onChange={() => set({ resultBy: val })}
                  style={{ accentColor: colors.primary }}
                />
                {val === 'count' ? 'Nombre commandes' : 'Quantité vendue'}
              </label>
            ))}
          </div>
        </div>

        {/* Affichage */}
        <div>
          <label style={labelSt}>Affichage</label>
          <div style={{ display: 'flex', gap: 16, height: 30, alignItems: 'center' }}>
            {(['number', 'percent'] as const).map(val => (
              <label key={val} style={radioLabel}>
                <input
                  type="radio"
                  checked={value.displayMode === val}
                  onChange={() => set({ displayMode: val })}
                  style={{ accentColor: colors.primary }}
                />
                {val === 'number' ? 'En nombre' : 'En pourcentage'}
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
