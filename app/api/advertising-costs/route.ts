import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

// GET — list advertising costs for the tenant (joins boutique name)
export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'accounting.enter_expenses')

  const { data, error } = await db
    .from('advertising_costs')
    .select(`
      id, amount, period_start, period_end, note, created_at,
      boutique_id,
      boutiques(name)
    `)
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data ?? []).map((r: any) => ({
    id:            r.id,
    amount:        Number(r.amount ?? 0),
    period_start:  r.period_start,
    period_end:    r.period_end,
    note:          r.note,
    created_at:    r.created_at,
    boutique_name: r.boutiques?.name ?? null,
  }))
  return NextResponse.json(items)
}

// POST — create an advertising cost
export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'accounting.enter_expenses')

  const body = await req.json().catch(() => null) as {
    boutique_id?:  string
    amount?:       number | string
    period_start?: string
    period_end?:   string
    note?:         string
  } | null

  const amount      = Number(body?.amount ?? 0)
  const periodStart = (body?.period_start ?? '').trim()
  const periodEnd   = (body?.period_end   ?? '').trim()

  if (!(amount > 0))   return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  if (!periodStart || !periodEnd) {
    return NextResponse.json({ error: 'Période De et À requises' }, { status: 400 })
  }

  const { data, error } = await db
    .from('advertising_costs')
    .insert({
      tenant_id:    user.tenantId,
      boutique_id:  (body?.boutique_id ?? '').trim() || null,
      user_id:      user.sub,
      amount,
      period_start: periodStart,
      period_end:   periodEnd,
      note:         (body?.note ?? '').trim() || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove an advertising cost ?id=
export async function DELETE(req: NextRequest) {
  const user = await requirePermission(req, 'accounting.enter_expenses')

  const id = (req.nextUrl.searchParams.get('id') ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await db
    .from('advertising_costs')
    .delete()
    .eq('id', id)
    .eq('tenant_id', user.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
