import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  await requirePermission(req, 'config.sources')

  const token   = req.nextUrl.searchParams.get('google_token')
  const sheetId = req.nextUrl.searchParams.get('sheet_id')
  if (!token || !sheetId) {
    return NextResponse.json({ error: 'google_token et sheet_id requis' }, { status: 400 })
  }

  try {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token })

    const sheets = google.sheets({ version: 'v4', auth })
    const res    = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields:        'sheets.properties(title,index)',
    })

    const tabs = (res.data.sheets ?? []).map(s => s.properties?.title ?? '')
    return NextResponse.json({ tabs })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = msg.includes('401') || msg.includes('invalid') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
