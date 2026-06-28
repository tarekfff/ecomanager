import { NextRequest, NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { syncSourceWithLock } from '@/lib/sync-google-sheet'

// Public endpoint — source UUID is the authentication token.
// Called by a Google Apps Script onEdit trigger for instant sync.
// Goes through syncSourceWithLock so it shares the atomic lock + dedup-key
// tracking with cron / Drive push / manual sync (never double-imports).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { data: source } = await db
    .from('import_sources')
    .select('id, boutique_id, sheet_id, sheet_name, separator, column_mapping, credentials_ref, is_active, boutiques!inner(tenant_id)')
    .eq('id', id)
    .eq('type', 'google_sheet')
    .single()

  if (!source || !source.is_active) {
    return NextResponse.json({ ok: false, reason: 'source inactive or not found' }, { status: 200 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyS      = source as any
  const boutiques = anyS.boutiques
  const tenantId  = Array.isArray(boutiques) ? boutiques[0]?.tenant_id : boutiques?.tenant_id

  // Keep the function alive past the response while the (locked) sync runs.
  after(async () => {
    await syncSourceWithLock(anyS, tenantId, 'sheet-webhook')
  })

  return NextResponse.json({ ok: true })
}
