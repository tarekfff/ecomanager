import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Wilayas are shared reference data — no auth required
export async function GET() {
  const { data, error } = await db
    .from('wilayas')
    .select('id, name, code')
    .order('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
