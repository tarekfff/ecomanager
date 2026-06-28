'use client'

import { ReactNode } from 'react'
import { colors, fonts } from '@/lib/tokens'

export interface Column<T = Record<string, unknown>> {
  key: string
  label: string
  width?: number
  render?: (row: T) => ReactNode
}

interface TableProps<T = Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyText?: string
  /** Custom empty-state node (e.g. <EmptyState …/>). Overrides emptyText. */
  empty?: ReactNode
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{
            height: 14,
            borderRadius: 3,
            background: '#ececec',
            width: '70%',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  )
}

export default function Table<T = Record<string, unknown>>({
  columns,
  data,
  loading = false,
  emptyText = 'Aucune donnée',
  empty,
}: TableProps<T>) {
  return (
    <div style={{
      width: '100%',
      background: '#fff',
      border: `1px solid ${colors.border}`,
      borderRadius: 4,
      overflow: 'auto',
      fontFamily: fonts.sans,
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: colors.textMd,
                  padding: '8px 12px',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  width: col.width,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  textAlign: 'center',
                  padding: empty ? 0 : '32px 12px',
                  color: colors.textLt,
                  fontSize: 13,
                }}
              >
                {empty ?? emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <TableRow key={rowIdx} row={row} columns={columns} isLast={rowIdx === data.length - 1} />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function TableRow<T>({
  row,
  columns,
  isLast,
}: {
  row: T
  columns: Column<T>[]
  isLast: boolean
}) {
  return (
    <tr
      style={{ cursor: 'default' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#FAFAFA' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
    >
      {columns.map((col) => (
        <td
          key={col.key}
          style={{
            fontSize: 12.5,
            padding: '8px 12px',
            color: colors.text,
            borderBottom: isLast ? 'none' : `1px solid ${colors.border}`,
          }}
        >
          {col.render
            ? col.render(row)
            : String((row as Record<string, unknown>)[col.key] ?? '')}
        </td>
      ))}
    </tr>
  )
}
