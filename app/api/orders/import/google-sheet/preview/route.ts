import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  requireAuth(req)
  const sp          = req.nextUrl.searchParams
  const sheetId     = sp.get('sheet_id')     ?? ''
  const sheetName   = sp.get('sheet_name')   ?? 'Sheet1'
  const googleToken = sp.get('google_token') ?? ''

  if (!sheetId || !googleToken) {
    return NextResponse.json({ error: 'sheet_id et google_token requis' }, { status: 400 })
  }

  try {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: googleToken })

    const sheets = google.sheets({ version: 'v4', auth })
    // Quote the tab name to handle spaces/special chars; use row-only range so column count doesn't matter
    const tab   = sheetName.includes(' ') || sheetName.includes("'") ? `'${sheetName.replace(/'/g, "\\'")}'` : sheetName
    const range = `${tab}!1:6`

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    })

    const rawRows = (data.values ?? []) as string[][]
    if (rawRows.length === 0) return NextResponse.json({ error: 'Feuille vide ou introuvable.' }, { status: 422 })

    const headers = rawRows[0].map((h: string) => String(h ?? '').trim()).filter(Boolean)
    if (headers.length === 0) return NextResponse.json({ error: 'Aucune colonne détectée.' }, { status: 422 })

    const rows = rawRows.slice(1, 6).map((row: string[]) =>
      headers.map((_: string, i: number) => String(row[i] ?? '').trim())
    )

    return NextResponse.json({ headers, rows })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('401') || msg.includes('invalid_token') || msg.includes('Invalid Credentials')) {
      return NextResponse.json({ error: '401 Token Google invalide ou expiré.' }, { status: 401 })
    }
    if (msg.includes('403')) {
      return NextResponse.json({ error: 'Accès refusé. Vérifiez que la feuille est partagée ou que vous avez les droits.' }, { status: 403 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
