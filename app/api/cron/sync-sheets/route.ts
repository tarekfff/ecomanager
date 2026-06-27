import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  syncSourceWithLock, getAccessToken,
  registerDriveWatch, stopDriveWatch,
} from '@/lib/sync-google-sheet'
import { v4 as uuid } from 'uuid'

export const dynamic = 'force-dynamic'
export const maxDuration = 60   // allow up to 60s to sync all sources

// Centralized sheet sync — the reliable real-time path. Runs every minute via
// an external scheduler (cron-job.org) or Vercel Cron. One pass syncs every
// active source for every store, so it scales independent of how many users
// are online. Each source goes through syncSourceWithLock (atomic-ish soft
// lock + idempotent windowed read) so the cron, Drive push, and manual syncs
// can never double-import or lose a row.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth      = req.headers.get('authorization')
    const qpSecret  = req.nextUrl.searchParams.get('secret')
    const ok = auth === `Bearer ${secret}` || qpSecret === secret
    if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: sources, error } = await db
    .from('import_sources')
    .select('id, boutique_id, sheet_id, sheet_name, separator, column_mapping, credentials_ref, boutiques!inner(tenant_id)')
    .eq('type', 'google_sheet')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let imported = 0
  let synced   = 0

  for (const source of sources ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyS      = source as any
    const boutiques = anyS.boutiques
    const tenantId  = Array.isArray(boutiques) ? boutiques[0]?.tenant_id : boutiques?.tenant_id

    const result = await syncSourceWithLock(anyS, tenantId, 'cron')
    if (result) { imported += result.imported; synced++ }

    await renewWatchIfNeeded(anyS.id, anyS.sheet_id)
  }

  return NextResponse.json({ sources: (sources ?? []).length, synced, imported })
}

export async function GET(req: NextRequest)  { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }

// Renew a Drive push channel before it expires (max 7 days for Sheets).
// Reads fresh creds so it never clobbers last_row updated by the sync above.
async function renewWatchIfNeeded(sourceId: string, sheetId: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl || appUrl.includes('localhost')) return

  const { data: row } = await db
    .from('import_sources').select('credentials_ref').eq('id', sourceId).single()
  if (!row) return

  let creds: { refresh_token?: string; watch_channel_id?: string; watch_resource_id?: string; watch_expiration?: number } = {}
  try { creds = JSON.parse((row as { credentials_ref: string }).credentials_ref ?? '{}') } catch { return }

  if (!creds.refresh_token || !creds.watch_channel_id) return
  if ((creds.watch_expiration ?? 0) - Date.now() > 48 * 60 * 60 * 1000) return  // >48h left

  try {
    const token = await getAccessToken(creds.refresh_token)
    if (creds.watch_resource_id) {
      await stopDriveWatch(token, creds.watch_channel_id, creds.watch_resource_id).catch(() => {})
    }
    const watch = await registerDriveWatch(token, sheetId, `${appUrl}/api/webhooks/drive/${sourceId}`, uuid())
    // Merge watch fields into the latest creds (re-read to keep last_row fresh)
    const { data: latest } = await db
      .from('import_sources').select('credentials_ref').eq('id', sourceId).single()
    let cur = creds
    try { cur = JSON.parse((latest as { credentials_ref: string }).credentials_ref ?? '{}') } catch { /* keep creds */ }
    const merged = { ...cur, watch_channel_id: watch.channelId, watch_resource_id: watch.resourceId, watch_expiration: watch.expiration }
    await db.from('import_sources').update({ credentials_ref: JSON.stringify(merged) }).eq('id', sourceId)
  } catch { /* watch renewal best-effort — cron keeps syncing regardless */ }
}
