// Shared date/time formatting for order tables. Times are stored as UTC in the DB
// and rendered in the viewer's local timezone (same behavior as the rest of the app).

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('fr-DZ', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit', hour12: false })
}
