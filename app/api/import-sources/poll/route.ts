import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { syncSourceWithLock } from '@/lib/sync-google-sheet'

export const dynamic = 'force-dynamic'

// Lightweight sync trigger called by open order pages every few seconds.
// Reliable real-time: doesn't depend on Google Drive push (which is delayed
// and coalesced). The soft lock in syncSourceWithLock prevents double-imports
// when the Drive webhook or cron fire at the same time.
export async function POST(req: NextRequest) {
  const user       = requireAuth(req)
  const boutiqueId = (req.nextUrl.searchParams.get('boutique_id') ?? '').trim()
  if (!boutiqueId) return NextResponse.json({ error: 'boutique_id requis' }, { status: 400 })

  // Verify boutique belongs to tenant
  const { data: boutique } = await db
    .from('boutiques').select('id').eq('id', boutiqueId).eq('tenant_id', user.tenantId).single()
  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable' }, { status: 403 })

  const { data: sources } = await db
    .from('import_sources')
    .select('id, boutique_id, sheet_id, sheet_name, separator, column_mapping, credentials_ref')
    .eq('boutique_id', boutiqueId)
    .eq('type', 'google_sheet')
    .eq('is_active', true)

  let imported = 0
  for (const source of sources ?? []) {
    const result = await syncSourceWithLock(source, user.tenantId, user.sub)
    if (result) imported += result.imported
  }

  return NextResponse.json({ imported })
}
