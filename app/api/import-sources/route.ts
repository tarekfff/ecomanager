import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

export async function GET(req: NextRequest) {
  const user       = requireAuth(req)
  const boutiqueId = req.nextUrl.searchParams.get('boutique_id') ?? ''

  if (!boutiqueId) return NextResponse.json({ error: 'boutique_id requis' }, { status: 400 })

  // Verify boutique belongs to tenant
  const { data: boutique } = await db
    .from('boutiques').select('id').eq('id', boutiqueId).eq('tenant_id', user.tenantId).single()
  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable' }, { status: 403 })

  const { data, error } = await db
    .from('import_sources')
    .select('id, name, type, sheet_id, sheet_name, separator, column_mapping, is_active, last_synced_at, credentials_ref, boutique_id')
    .eq('boutique_id', boutiqueId)
    .eq('type', 'google_sheet')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data ?? []).map((s: any) => {
    let creds: { google_email?: string; last_row?: number } = {}
    try { creds = JSON.parse(s.credentials_ref ?? '{}') } catch { /* ignore */ }
    return {
      id:             s.id,
      name:           s.name,
      sheet_id:       s.sheet_id,
      sheet_name:     s.sheet_name,
      separator:      s.separator,
      column_mapping: s.column_mapping,
      is_active:      s.is_active,
      last_synced_at: s.last_synced_at,
      google_email:   creds.google_email ?? '',
      last_row:       creds.last_row ?? 0,
    }
  })

  return NextResponse.json(items)
}

interface CreateBody {
  name:          string
  boutique_id:   string
  sheet_id:      string
  sheet_name:    string
  separator:     string
  mapping:       Record<string, string>
  refresh_token: string
  google_email:  string
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req)
  const body = await req.json() as CreateBody
  const { name, boutique_id, sheet_id, sheet_name, separator, mapping, refresh_token, google_email } = body

  if (!boutique_id || !sheet_id || !refresh_token) {
    return NextResponse.json({ error: 'boutique_id, sheet_id et refresh_token requis' }, { status: 400 })
  }

  // Verify boutique belongs to tenant
  const { data: boutique } = await db
    .from('boutiques').select('id').eq('id', boutique_id).eq('tenant_id', user.tenantId).single()
  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable' }, { status: 403 })

  const credentials_ref = JSON.stringify({ refresh_token, google_email, last_row: 1 })

  const { data, error } = await db
    .from('import_sources')
    .insert({
      id:             uuid(),
      boutique_id,
      type:           'google_sheet',
      name:           name || `Google Sheet — ${sheet_name || sheet_id}`,
      sheet_id,
      sheet_name:     sheet_name || 'Sheet1',
      separator:      separator  || '|',
      column_mapping: mapping,
      credentials_ref,
      is_active:      true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
