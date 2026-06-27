import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { syncSourceWithLock } from '@/lib/sync-google-sheet'

// Manual "Sync now" — goes through the same atomic-locked path as cron/webhook
// so it can never double-import alongside them.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user   = requireAuth(req)
  const { id } = await params

  const { data: source } = await db
    .from('import_sources')
    .select('id, boutique_id, sheet_id, sheet_name, separator, column_mapping, credentials_ref, boutiques!inner(tenant_id)')
    .eq('id', id)
    .single()

  if (!source) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyS = source as any
  const boutiques = anyS.boutiques
  const tid = Array.isArray(boutiques) ? boutiques[0]?.tenant_id : boutiques?.tenant_id
  if (tid !== user.tenantId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const result = await syncSourceWithLock(anyS, user.tenantId, user.sub)

  if (!result) {
    // Either no token, or a sync just ran (lock) — report a no-op rather than error.
    return NextResponse.json({ imported: 0, skipped: 0, failed: 0, errors: [], throttled: true })
  }
  return NextResponse.json(result)
}
