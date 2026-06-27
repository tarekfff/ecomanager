import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// Returns all active tenant products — no boutique_id required
// Used by stats filter dropdowns
export async function GET(req: NextRequest) {
  const user   = requireAuth(req)
  const search = (req.nextUrl.searchParams.get('search') ?? '').trim()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db
    .from('products')
    .select('id, name, sku')
    .eq('tenant_id', user.tenantId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')
    .limit(500)

  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
