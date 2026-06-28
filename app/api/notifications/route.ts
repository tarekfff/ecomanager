import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// GET — the current user's latest unread notifications + total unread count.
export async function GET(req: NextRequest) {
  const user = requireAuth(req)

  const { data, error, count } = await db
    .from('notifications')
    .select('id, type, title, body, is_read, meta, created_at', { count: 'exact' })
    .eq('user_id', user.sub)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [], unread: count ?? 0 })
}
