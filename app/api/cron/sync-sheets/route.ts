import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncGoogleSheet, getAccessToken } from '@/lib/sync-google-sheet'
import { v4 as uuid } from 'uuid'

// Called by Vercel Cron on schedule — authenticated via CRON_SECRET header
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Load all active google_sheet sources across all tenants
  const { data: sources, error } = await db
    .from('import_sources')
    .select('id, boutique_id, sheet_id, sheet_name, separator, column_mapping, credentials_ref, boutiques!inner(tenant_id)')
    .eq('type', 'google_sheet')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { id: string; imported: number; skipped: number; failed: number; error?: string }[] = []

  for (const source of (sources ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyS = source as any

    let creds: { refresh_token?: string; google_email?: string; last_row?: number } = {}
    try { creds = JSON.parse(anyS.credentials_ref ?? '{}') } catch { /* ignore */ }

    if (!creds.refresh_token) {
      results.push({ id: anyS.id, imported: 0, skipped: 0, failed: 0, error: 'No refresh_token' })
      continue
    }

    const boutiques = anyS.boutiques
    const tenantId  = Array.isArray(boutiques) ? boutiques[0]?.tenant_id : boutiques?.tenant_id

    const runId = uuid()
    await db.from('import_runs').insert({
      id: runId, import_source_id: anyS.id,
      rows_total: 0, rows_imported: 0, rows_failed: 0,
      status: 'running', errors: [],
    })

    try {
      const accessToken = await getAccessToken(creds.refresh_token)
      const startRow    = creds.last_row ?? 1

      const result = await syncGoogleSheet({
        accessToken,
        sheetId:    anyS.sheet_id,
        sheetName:  anyS.sheet_name ?? 'Sheet1',
        separator:  anyS.separator  ?? '|',
        boutiqueId: anyS.boutique_id,
        mapping:    anyS.column_mapping ?? {},
        startRow,
        tenantId,
        userId:     'cron',
      })

      const newCreds = { ...creds, last_row: result.last_row }
      await db.from('import_sources').update({
        credentials_ref: JSON.stringify(newCreds),
        last_synced_at:  new Date().toISOString(),
      }).eq('id', anyS.id)

      await db.from('import_runs').update({
        rows_total:    result.imported + result.skipped + result.failed,
        rows_imported: result.imported,
        rows_failed:   result.failed,
        status:        result.failed > 0 ? 'partial' : 'completed',
        errors:        result.errors,
      }).eq('id', runId)

      results.push({ id: anyS.id, imported: result.imported, skipped: result.skipped, failed: result.failed })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      await db.from('import_runs').update({ status: 'failed', errors: [{ reason: msg }] }).eq('id', runId)
      results.push({ id: anyS.id, imported: 0, skipped: 0, failed: 0, error: msg })
    }
  }

  return NextResponse.json({ synced: results.length, results })
}
