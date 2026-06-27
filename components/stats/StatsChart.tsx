'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { colors, fonts } from '@/lib/tokens'
import { STATUS_COLS, type StatsRow } from './StatsTable'

interface StatsChartProps {
  rows:        StatsRow[]
  displayMode: 'number' | 'percent'
}

export default function StatsChart({ rows, displayMode }: StatsChartProps) {
  const top10 = rows.slice(0, 10)
  if (top10.length === 0) return null

  const chartData = top10.map(row => {
    const entry: Record<string, string | number> = {
      name: row.dimLabel.length > 18 ? row.dimLabel.slice(0, 16) + '…' : row.dimLabel,
    }
    for (const s of STATUS_COLS) {
      const val = row.counts[s.slug] ?? 0
      entry[s.slug] = displayMode === 'percent' && row.total > 0
        ? Number((val / row.total * 100).toFixed(1))
        : val
    }
    return entry
  })

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${colors.border}`,
      borderRadius: 4,
      padding: '14px 16px 8px',
      fontFamily: fonts.sans,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: colors.textMd, marginBottom: 12 }}>
        Top 10 — {displayMode === 'percent' ? 'Répartition (%)' : 'Volume'}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 4, right: 20, bottom: 44, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fontFamily: fonts.sans, fill: colors.textMd }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11, fontFamily: fonts.sans, fill: colors.textMd }}
            unit={displayMode === 'percent' ? '%' : ''}
            width={40}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, fontFamily: fonts.sans, border: `1px solid ${colors.border}` }}
            formatter={(val: number, name: string) => {
              const col = STATUS_COLS.find(s => s.slug === name)
              const label = col?.label ?? name
              return [displayMode === 'percent' ? val + '%' : val, label]
            }}
          />
          <Legend
            formatter={name => {
              const col = STATUS_COLS.find(s => s.slug === name)
              return <span style={{ fontSize: 11, fontFamily: fonts.sans }}>{col?.label ?? name}</span>
            }}
            wrapperStyle={{ paddingTop: 6 }}
          />
          {STATUS_COLS.map(s => (
            <Bar key={s.slug} dataKey={s.slug} stackId="a" fill={s.color} maxBarSize={40} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
