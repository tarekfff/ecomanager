import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

function oauthClient(origin: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${origin}/api/auth/google/callback`
  )
}

function getOrigin(req: NextRequest): string {
  // x-forwarded-host is set by Vercel's edge proxy; nextUrl.origin is localhost behind proxy
  const host  = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? ''
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
}

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get('return_to') ?? '/dashboard/orders/import/google-sheet'
  const origin   = getOrigin(req)

  const oauth2 = oauthClient(origin)
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',   // gets refresh_token so server can sync without user
    prompt:      'consent',   // forces re-consent to always receive refresh_token
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    state: encodeURIComponent(returnTo),
  })

  return NextResponse.redirect(url)
}
