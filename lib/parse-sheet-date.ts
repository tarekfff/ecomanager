/**
 * Parse a spreadsheet "Date Time" cell into an ISO-8601 UTC string, preserving the
 * full timestamp (day AND hh:mm:ss) — not just the date.
 *
 * Handles the common Shopify / YouCan export format used by Algerian COD sheets,
 * which JavaScript's `new Date()` cannot parse natively (it reads DD/MM as MM/DD):
 *
 *   26/07/2026 21:46:21 +00:00   → 2026-07-26T21:46:21.000Z
 *   26/07/2026 21:46             → 2026-07-26T21:46:00.000Z (no offset → UTC)
 *   26-07-2026 9:05:00 +01:00    → 2026-07-26T08:05:00.000Z
 *
 * Returns null when the value is empty or unparseable, so callers fall back to the
 * database default (NOW()) rather than dropping the order.
 */
export function parseSheetDate(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim()
  if (!s) return null

  // DD/MM/YYYY [HH:mm[:ss]] [±HH:mm | ±HHmm | Z]
  const m = s.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\s*(Z|[+-]\d{2}:?\d{2})?/i,
  )
  if (m) {
    const day = +m[1], month = +m[2], year = +m[3]
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const pad = (n: number | string) => String(n).padStart(2, '0')
      const hh = m[4] ?? '0', mi = m[5] ?? '0', ss = m[6] ?? '0'
      let tz = m[7]
      if (!tz || tz.toUpperCase() === 'Z') tz = 'Z'
      else if (!tz.includes(':')) tz = `${tz.slice(0, 3)}:${tz.slice(3)}` // +0100 → +01:00
      const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mi)}:${pad(ss)}${tz}`
      const d = new Date(iso)
      if (!isNaN(d.getTime())) return d.toISOString()
    }
  }

  // Fallback: ISO-8601 or anything the JS engine understands natively.
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}
