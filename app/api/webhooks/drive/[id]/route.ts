import { NextRequest, NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { syncSourceWithLock } from '@/lib/sync-google-sheet'

// Called by Google Drive push notifications when the spreadsheet changes.
// Google sends: X-Goog-Resource-State: sync | update | change | add | remove | trash
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const state = req.headers.get('x-goog-resource-state')
  if (!state || state === 'sync') {
    return NextResponse.json({ ok: true })
  }

  const { data: source } = await db
    .from('import_sources')
    .select('id, boutique_id, sheet_id, sheet_name, separator, column_mapping, credentials_ref, is_active, boutiques!inner(tenant_id)')
    .eq('id', id)
    .eq('type', 'google_sheet')
    .single()

  if (!source || !source.is_active) return NextResponse.json({ ok: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyS      = source as any
  const boutiques = anyS.boutiques
  const tenantId  = Array.isArray(boutiques) ? boutiques[0]?.tenant_id : boutiques?.tenant_id

  // after() keeps the Vercel function alive past the response while the
  // (locked) sync runs. The lock prevents collisions with the frontend poll.
  after(async () => {
    await syncSourceWithLock(anyS, tenantId, 'drive-webhook')
  })

  return NextResponse.json({ ok: true })
}
