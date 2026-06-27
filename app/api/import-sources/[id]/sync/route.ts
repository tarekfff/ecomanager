import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { syncGoogleSheet, getAccessToken } from '@/lib/sync-google-sheet'
import { v4 as uuid } from 'uuid'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireAuth(req)
  const { id } = await params

  // Load source and verify ownership
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

  let creds: { refresh_token?: string; google_email?: string; last_row?: number } = {}
  try { creds = JSON.parse(anyS.credentials_ref ?? '{}') } catch { /* ignore */ }

  if (!creds.refresh_token) {
    return NextResponse.json({ error: 'Token Google manquant. Reconnectez le compte.' }, { status: 400 })
  }

  // Create run record
  const runId = uuid()
  await db.from('import_runs').insert({
    id:               runId,
    import_source_id: id,
    rows_total:       0,
    rows_imported:    0,
    rows_failed:      0,
    status:           'running',
    errors:           [],
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
      tenantId:   user.tenantId,
      userId:     user.sub,
    })

    // Update credentials with new last_row
    const newCreds = { ...creds, last_row: result.last_row }
    await db.from('import_sources').update({
      credentials_ref: JSON.stringify(newCreds),
      last_synced_at:  new Date().toISOString(),
    }).eq('id', id)

    // Update run record
    await db.from('import_runs').update({
      rows_total:    result.imported + result.skipped + result.failed,
      rows_imported: result.imported,
      rows_failed:   result.failed,
      status:        result.failed > 0 ? 'partial' : 'completed',
      errors:        result.errors,
    }).eq('id', runId)

    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.from('import_runs').update({ status: 'failed', errors: [{ reason: msg }] }).eq('id', runId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
