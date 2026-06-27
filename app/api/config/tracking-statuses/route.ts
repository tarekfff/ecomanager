import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = requireAuth(req)

  const { data, error } = await db
    .from('tracking_statuses')
    .select('id, name, slug, sms_notify, is_system, is_active, sort_order')
    .eq('tenant_id', user.tenantId)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
