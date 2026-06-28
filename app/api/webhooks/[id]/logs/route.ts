import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'webhooks.view_logs')
  const { id } = await params

  // Verify the webhook belongs to this tenant before exposing its logs
  const { data: webhook } = await db
    .from('webhooks')
    .select('id, name, event')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!webhook) return NextResponse.json({ error: 'Webhook introuvable' }, { status: 404 })

  const sp     = req.nextUrl.searchParams
  const page   = Math.max(1, parseInt(sp.get('page')  ?? '1'))
  const limit  = Math.min(100, parseInt(sp.get('limit') ?? '25'))
  const offset = (page - 1) * limit

  const { data, error, count } = await db
    .from('webhook_logs')
    .select('id, webhook_id, order_id, event, http_status, request_payload, response_body, attempt, duration_ms, created_at', { count: 'exact' })
    .eq('webhook_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve order references for the page
  const orderIds = [...new Set((data ?? []).map((l: { order_id: string | null }) => l.order_id).filter(Boolean))] as string[]
  const refById = new Map<string, string>()
  if (orderIds.length > 0) {
    const { data: orders } = await db
      .from('orders')
      .select('id, reference')
      .in('id', orderIds)
    for (const o of (orders ?? []) as { id: string; reference: string }[]) {
      refById.set(o.id, o.reference)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data ?? []).map((l: any) => ({
    ...l,
    order_ref: l.order_id ? refById.get(l.order_id) ?? null : null,
  }))

  return NextResponse.json({ items, total: count ?? 0, webhook })
}
