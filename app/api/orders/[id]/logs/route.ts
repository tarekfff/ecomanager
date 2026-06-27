import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const user   = requireAuth(req)
  const { id } = await params

  // Verify ownership via boutique
  const { data: order } = await db
    .from('orders')
    .select('boutique_id')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', (order as { boutique_id: string }).boutique_id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!boutique) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data, error } = await db
    .from('order_logs')
    .select('id, action, new_values, created_at, users!user_id(name)')
    .eq('order_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logs = (data ?? []).map((l: any) => ({
    id:         l.id,
    action:     l.action,
    new_values: l.new_values ?? null,
    created_at: l.created_at,
    user_name:  (l.users as { name: string } | null)?.name ?? null,
  }))

  return NextResponse.json(logs)
}
