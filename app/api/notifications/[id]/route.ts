import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

// PATCH — mark a single notification as read (scoped to the current user).
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params

  const body = await req.json().catch(() => ({}))
  const isRead = body?.is_read !== false   // default to marking read

  const { data, error } = await db
    .from('notifications')
    .update({ is_read: isRead })
    .eq('id', id)
    .eq('user_id', user.sub)
    .select('id, is_read')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Notification introuvable' }, { status: 404 })
  return NextResponse.json(data)
}
