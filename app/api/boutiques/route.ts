import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = requireAuth(req)

  // Resolve which boutique IDs this user is assigned to
  const { data: ubRows, error: ubErr } = await db
    .from('user_boutiques')
    .select('boutique_id')
    .eq('user_id', user.sub)

  if (ubErr) return NextResponse.json({ error: ubErr.message }, { status: 500 })

  const ids = (ubRows ?? []).map((r: { boutique_id: string }) => r.boutique_id)
  if (ids.length === 0) return NextResponse.json([])

  const { data, error } = await db
    .from('boutiques')
    .select('id, name, prefix')
    .eq('tenant_id', user.tenantId)
    .eq('is_active', true)
    .in('id', ids)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
