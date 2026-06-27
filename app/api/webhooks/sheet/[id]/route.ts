import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { syncGoogleSheet, getAccessToken } from '@/lib/sync-google-sheet'
import { v4 as uuid } from 'uuid'

// Public endpoint — source UUID is the authentication token
// Called by Google Apps Script onEdit trigger for instant sync
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
  const anyS     = source as any
  const boutiques = anyS.boutiques
  const tenantId  = Array.isArray(boutiques) ? boutiques[0]?.tenant_id : boutiques?.tenant_id

  let creds: { refresh_token?: string; google_email?: string; last_row?: number } = {}
  try { creds = JSON.parse(anyS.credentials_ref ?? '{}') } catch { /* ignore */ }

  if (!creds.refresh_token) {
    return NextResponse.json({ ok: false, reason: 'no refresh_token' }, { status: 200 })
  }

  const runId = uuid()
  await db.from('import_runs').insert({
    id: runId, import_source_id: id,
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
      userId:     'webhook',
    })

    const newCreds = { ...creds, last_row: result.last_row }
    await db.from('import_sources').update({
      credentials_ref: JSON.stringify(newCreds),
      last_synced_at:  new Date().toISOString(),
    }).eq('id', id)

    await db.from('import_runs').update({
      rows_total:    result.imported + result.skipped + result.failed,
      rows_imported: result.imported,
      rows_failed:   result.failed,
      status:        result.failed > 0 ? 'partial' : 'completed',
      errors:        result.errors,
    }).eq('id', runId)

    return NextResponse.json({ ok: true, imported: result.imported, skipped: result.skipped })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.from('import_runs').update({ status: 'failed', errors: [{ reason: msg }] }).eq('id', runId)
    return NextResponse.json({ ok: false, reason: msg }, { status: 200 })
  }
}
