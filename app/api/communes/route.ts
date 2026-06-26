import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Communes are shared reference data — no auth required
export async function GET(req: NextRequest) {
  const wilayaId = req.nextUrl.searchParams.get('wilaya_id')
  if (!wilayaId) {
    return NextResponse.json({ error: 'wilaya_id requis' }, { status: 400 })
  }

  const { data, error } = await db
    .from('communes')
    .select('id, name')
    .eq('wilaya_id', parseInt(wilayaId))
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
