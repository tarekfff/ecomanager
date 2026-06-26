import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

const STATUS_KEYS = [
  'en_confirmation', 'en_preparation', 'en_dispatch',
  'en_livraison', 'livree', 'en_retour',
  'encaissee', 'retournee', 'annulee',
] as const

type StatusKey = typeof STATUS_KEYS[number]

// Statuses that mean the order passed confirmation
const PAST_CONFIRMATION = new Set<string>([
  'en_preparation', 'en_dispatch', 'en_livraison',
  'livree', 'encaissee', 'en_retour', 'retournee',
])
// Statuses that count as delivered
const DELIVERED = new Set<string>(['livree', 'encaissee', 'retournee'])

export async function GET(req: NextRequest) {
  const user = requireAuth(req)
  const boutiqueId = req.nextUrl.searchParams.get('boutiqueId')

  if (!boutiqueId) {
    return NextResponse.json({ error: 'boutiqueId requis' }, { status: 400 })
  }

  // Security: confirm boutique belongs to this tenant
  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', boutiqueId)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!boutique) {
    return NextResponse.json({ error: 'Boutique introuvable' }, { status: 404 })
  }

  // ── 1. All non-deleted orders → current status counts ──────────────────
  const { data: allOrders, error: e1 } = await db
    .from('orders')
    .select('tracking_status')
    .eq('boutique_id', boutiqueId)
    .is('deleted_at', null)

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })

  const counts = Object.fromEntries(STATUS_KEYS.map(k => [k, 0])) as Record<StatusKey, number>
  for (const o of allOrders ?? []) {
    const s = o.tracking_status as StatusKey
    if (s in counts) counts[s]++
  }

  // ── 2. Last 7 days orders → chart data ─────────────────────────────────
  const since = new Date()
  since.setDate(since.getDate() - 6)
  since.setHours(0, 0, 0, 0)

  const { data: recentOrders, error: e2 } = await db
    .from('orders')
    .select('tracking_status, created_at')
    .eq('boutique_id', boutiqueId)
    .is('deleted_at', null)
    .gte('created_at', since.toISOString())

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  // Build day buckets (YYYY-MM-DD) for the last 7 days
  const dayKeys: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dayKeys.push(d.toISOString().slice(0, 10))
  }

  const byDay: Record<string, Record<string, number>> = {}
  for (const k of dayKeys) byDay[k] = {}

  for (const o of recentOrders ?? []) {
    const day = (o.created_at as string).slice(0, 10)
    if (!(day in byDay)) continue
    byDay[day][o.tracking_status] = (byDay[day][o.tracking_status] ?? 0) + 1
  }

  const chartData = dayKeys.map(day => {
    const row = byDay[day]
    const total = Object.values(row).reduce((s, v) => s + v, 0)
    // Short French label: "26 Jun"
    const label = new Date(day + 'T12:00:00Z').toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short',
    })
    return {
      day: label,
      Créées:      total,
      Confirmées:  sumWhere(row, PAST_CONFIRMATION),
      Annulées:    row['annulee']   ?? 0,
      Livrées:     sumWhere(row, DELIVERED),
      'En retour': (row['en_retour'] ?? 0) + (row['retournee'] ?? 0),
      Encaissées:  row['encaissee'] ?? 0,
      Retournées:  row['retournee'] ?? 0,
    }
  })

  return NextResponse.json({ counts, chartData })
}

function sumWhere(row: Record<string, number>, set: Set<string>): number {
  return Object.entries(row)
    .filter(([s]) => set.has(s))
    .reduce((acc, [, v]) => acc + v, 0)
}
