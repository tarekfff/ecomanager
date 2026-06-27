import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = requireAuth(req)

  const { data, error } = await db
    .from('v_stock_alerts')
    .select('*')
    .eq('tenant_id', user.tenantId)
    .order('current_qty', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
