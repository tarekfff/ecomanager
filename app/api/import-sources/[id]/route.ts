import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getAccessToken, stopDriveWatch } from '@/lib/sync-google-sheet'

async function getOwnedSource(id: string, tenantId: string) {
  const { data } = await db
    .from('import_sources')
    .select('id, is_active, credentials_ref, boutiques!inner(tenant_id)')
    .eq('id', id)
    .single()
  if (!data) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyD = data as any
  const boutiques = anyD.boutiques
  const tid = Array.isArray(boutiques) ? boutiques[0]?.tenant_id : boutiques?.tenant_id
  if (tid !== tenantId) return null
  return data
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireAuth(req)
  const { id } = await params

  const source = await getOwnedSource(id, user.tenantId)
  if (!source) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const body = await req.json() as { is_active?: boolean; name?: string }

  const updates: Record<string, unknown> = {}
  if (body.is_active !== undefined) updates.is_active = body.is_active
  if (body.name      !== undefined) updates.name      = body.name

  const { error } = await db.from('import_sources').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireAuth(req)
  const { id } = await params

  const source = await getOwnedSource(id, user.tenantId)
  if (!source) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  // Stop the Drive watch before deleting so Google stops sending notifications
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creds = JSON.parse((source as any).credentials_ref ?? '{}')
    if (creds.refresh_token && creds.watch_channel_id && creds.watch_resource_id) {
      const accessToken = await getAccessToken(creds.refresh_token)
      await stopDriveWatch(accessToken, creds.watch_channel_id, creds.watch_resource_id)
    }
  } catch { /* silent */ }

  const { error } = await db.from('import_sources').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
