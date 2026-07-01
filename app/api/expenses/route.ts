import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

// GET — list expenses for the tenant (joins type + boutique names)
export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'accounting.enter_expenses')

  const { data, error } = await db
    .from('expenses')
    .select(`
      id, amount, period_type, period_start, period_end, note, created_at,
      expense_type_id, boutique_id,
      expense_types(name),
      boutiques(name)
    `)
    .eq('tenant_id', user.tenantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data ?? []).map((r: any) => ({
    id:           r.id,
    amount:       Number(r.amount ?? 0),
    period_type:  r.period_type,
    period_start: r.period_start,
    period_end:   r.period_end,
    note:         r.note,
    created_at:   r.created_at,
    type_name:    r.expense_types?.name ?? '—',
    boutique_name: r.boutiques?.name ?? null,
  }))
  return NextResponse.json(items)
}

// POST — create an expense
export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'accounting.enter_expenses')

  const body = await req.json().catch(() => null) as {
    expense_type_id?: string
    boutique_id?:     string
    amount?:          number | string
    period_type?:     string
    period_start?:    string
    period_end?:      string
    note?:            string
  } | null

  const expenseTypeId = (body?.expense_type_id ?? '').trim()
  const periodType    = (body?.period_type ?? 'one_time').trim()
  const amount        = Number(body?.amount ?? 0)

  if (!expenseTypeId) return NextResponse.json({ error: 'Type de charge requis' }, { status: 400 })
  if (!(amount > 0))  return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
  if (!['one_time', 'monthly', 'date_range'].includes(periodType)) {
    return NextResponse.json({ error: 'Type de période invalide' }, { status: 400 })
  }

  const periodStart = (body?.period_start ?? '').trim() || null
  const periodEnd   = (body?.period_end   ?? '').trim() || null

  if (periodType === 'date_range' && (!periodStart || !periodEnd)) {
    return NextResponse.json({ error: 'Dates de début et de fin requises' }, { status: 400 })
  }

  const { data, error } = await db
    .from('expenses')
    .insert({
      tenant_id:       user.tenantId,
      boutique_id:     (body?.boutique_id ?? '').trim() || null,
      expense_type_id: expenseTypeId,
      user_id:         user.sub,
      amount,
      period_type:     periodType,
      period_start:    periodStart,
      period_end:      periodEnd,
      note:            (body?.note ?? '').trim() || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove an expense ?id=
export async function DELETE(req: NextRequest) {
  const user = await requirePermission(req, 'accounting.enter_expenses')

  const id = (req.nextUrl.searchParams.get('id') ?? '').trim()
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await db
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('tenant_id', user.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
