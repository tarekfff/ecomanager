'use client'

import { useTranslation } from 'react-i18next'
import { colors, fonts } from '@/lib/tokens'

export interface StatsRow {
  dimId:    string
  dimLabel: string
  counts:   Record<string, number>
  total:    number
}

interface StatsTableProps {
  rows:           StatsRow[]
  loading:        boolean
  displayMode:    'number' | 'percent'
  dimensionLabel: string
}

const STATUS_COLS_CONFIG = [
  { slug: 'en_confirmation', color: '#4472C4', bg: '#EEF3FB' },
  { slug: 'en_preparation',  color: '#9966CC', bg: '#F3EEF8' },
  { slug: 'en_dispatch',     color: '#B89200', bg: '#FEFAE8' },
  { slug: 'en_livraison',    color: '#666666', bg: '#F2F2F2' },
  { slug: 'livrees',         color: '#00897B', bg: '#E0F2F1' },
  { slug: 'en_retour',       color: '#E84B6A', bg: '#FDEEF2' },
  { slug: 'encaissee',       color: '#2E7D32', bg: '#E8F5E9' },
  { slug: 'retournee',       color: '#546E7A', bg: '#ECEFF1' },
  { slug: 'annulee',         color: '#C62828', bg: '#FFEBEE' },
] as const

export type StatusSlug = (typeof STATUS_COLS_CONFIG)[number]['slug']

function fmtCell(val: number, rowTotal: number, displayMode: 'number' | 'percent'): string {
  if (val === 0) return ''
  if (displayMode === 'percent') {
    if (rowTotal === 0) return '—'
    return (val / rowTotal * 100).toFixed(1) + '%'
  }
  return val.toLocaleString('fr-DZ')
}

export default function StatsTable({ rows, loading, displayMode, dimensionLabel }: StatsTableProps) {
  const { t } = useTranslation('stats')

  const STATUS_COLS = STATUS_COLS_CONFIG.map(c => ({
    ...c,
    label: t(`statusCols.${c.slug}`),
  }))

  if (loading) {
    return (
      <div style={emptyBox}>{t('loading')}</div>
    )
  }

  if (rows.length === 0) {
    return (
      <div style={emptyBox}>{t('noData')}</div>
    )
  }

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${colors.border}`,
      borderRadius: 4,
      overflow: 'auto',
      fontFamily: fonts.sans,
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ ...thBase, textAlign: 'left', minWidth: 160 }}>{dimensionLabel}</th>
            {STATUS_COLS.map(s => (
              <th key={s.slug} style={{ ...thBase, color: s.color, minWidth: 96 }}>
                {s.label}
              </th>
            ))}
            <th style={{ ...thBase, minWidth: 72 }}>{t('total')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isLast = i === rows.length - 1
            return (
              <tr
                key={row.dimId}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAFAFA' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
              >
                <td style={{ ...tdBase(isLast), fontWeight: 500, color: colors.text }}>
                  {row.dimLabel || '—'}
                </td>
                {STATUS_COLS.map(s => {
                  const val = row.counts[s.slug] ?? 0
                  const txt = fmtCell(val, row.total, displayMode)
                  return (
                    <td key={s.slug} style={{ ...tdBase(isLast), textAlign: 'center' }}>
                      {txt ? (
                        <span style={{
                          background: s.bg,
                          color: s.color,
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 11.5,
                          fontWeight: 600,
                          display: 'inline-block',
                          whiteSpace: 'nowrap',
                        }}>
                          {txt}
                        </span>
                      ) : (
                        <span style={{ color: colors.textLt, fontSize: 11 }}>—</span>
                      )}
                    </td>
                  )
                })}
                <td style={{ ...tdBase(isLast), textAlign: 'center', fontWeight: 700, color: colors.text }}>
                  {row.total.toLocaleString('fr-DZ')}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const emptyBox: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${colors.border}`,
  borderRadius: 4,
  padding: 40,
  textAlign: 'center',
  color: colors.textLt,
  fontFamily: fonts.sans,
  fontSize: 13,
}

const thBase: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: colors.textMd,
  padding: '8px 10px',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  borderBottom: `1px solid ${colors.border}`,
}

function tdBase(isLast: boolean): React.CSSProperties {
  return {
    fontSize: 12.5,
    padding: '7px 10px',
    color: colors.textMd,
    borderBottom: isLast ? 'none' : `1px solid ${colors.border}`,
  }
}
