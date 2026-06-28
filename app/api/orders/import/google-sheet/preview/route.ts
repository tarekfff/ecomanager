import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  await requirePermission(req, 'config.sources')
  const sp          = req.nextUrl.searchParams
  const sheetId     = sp.get('sheet_id')     ?? ''
  const sheetName   = sp.get('sheet_name')   ?? ''
  const googleToken = sp.get('google_token') ?? ''

  if (!sheetId || !googleToken) {
    return NextResponse.json({ error: 'sheet_id et google_token requis' }, { status: 400 })
  }

  try {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: googleToken })

    const sheets = google.sheets({ version: 'v4', auth })

    // Use spreadsheets.get with includeGridData so we never need to build a range string
    // (both "ZZ6" and "1:6" formats can fail on some sheet types)
    const { data } = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      includeGridData: true,
    })

    // Find the requested sheet by name, or fall back to the first sheet
    const targetSheet = sheetName
      ? data.sheets?.find(s => s.properties?.title === sheetName) ?? data.sheets?.[0]
      : data.sheets?.[0]

    if (!targetSheet) {
      return NextResponse.json({ error: 'Feuille introuvable.' }, { status: 422 })
    }

    // Extract first 6 rows from grid data
    const gridData = targetSheet.data?.[0]
    const allRows  = gridData?.rowData ?? []
    const preview  = allRows.slice(0, 6)

    if (preview.length === 0) {
      return NextResponse.json({ error: 'Feuille vide.' }, { status: 422 })
    }

    // Build string matrix from CellData
    function rowValues(row: typeof allRows[0]): string[] {
      return (row.values ?? []).map(cell =>
        String(cell.formattedValue ?? cell.userEnteredValue?.stringValue ?? '').trim()
      )
    }

    const headers = rowValues(preview[0]).filter(Boolean)
    if (headers.length === 0) {
      return NextResponse.json({ error: 'Aucune colonne détectée.' }, { status: 422 })
    }

    const rows = preview.slice(1).map(row => {
      const vals = rowValues(row)
      return headers.map((_, i) => vals[i] ?? '')
    })

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
