import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// PATCH — mark ALL of the current user's notifications as read.
export async function PATCH(req: NextRequest) {
  const user = requireAuth(req)

  const body = await req.json().catch(() => ({}))
  const isRead = body?.is_read !== false   // default to marking read

  const { error } = await db
    .from('notifications')
    .update({ is_read: isRead })
    .eq('user_id', user.sub)
    .eq('is_read', !isRead)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
