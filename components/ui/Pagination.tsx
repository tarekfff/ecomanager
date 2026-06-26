'use client'

import { colors, fonts } from '@/lib/tokens'

interface PaginationProps {
  page: number
  total: number
  limit: number
  onChange: (page: number) => void
}

export default function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  const pages = buildPageNumbers(page, totalPages)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 0',
      fontFamily: fonts.sans,
      fontSize: 12,
      color: colors.textMd,
    }}>
      <span>
        Affichage {from}–{to} sur {total} résultats
      </span>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <PageBtn
          label="Précédent"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          active={false}
        />

        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: colors.textLt }}>…</span>
          ) : (
            <PageBtn
              key={p}
              label={String(p)}
              active={p === page}
              onClick={() => onChange(p as number)}
              disabled={false}
            />
          )
        )}

        <PageBtn
          label="Suivant"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          active={false}
        />
      </div>
    </div>
  )
}

function PageBtn({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px',
        fontSize: 12,
        fontFamily: fonts.sans,
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        cursor: disabled ? 'default' : 'pointer',
        background: active ? colors.primary : '#fff',
        color: active ? '#fff' : disabled ? colors.textLt : colors.text,
        fontWeight: active ? 600 : 400,
        transition: 'background 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  )
}

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]

  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')

  pages.push(total)
  return pages
}
