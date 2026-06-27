import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  requireAuth(req)

  const token = req.nextUrl.searchParams.get('google_token')
  if (!token) return NextResponse.json({ error: 'google_token requis' }, { status: 400 })

  try {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: token })

    const drive = google.drive({ version: 'v3', auth })
    const res   = await drive.files.list({
      q:        "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields:   'files(id,name,modifiedTime)',
      orderBy:  'modifiedTime desc',
      pageSize: 50,
    })

    return NextResponse.json({ files: res.data.files ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = msg.includes('401') || msg.includes('invalid') ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
