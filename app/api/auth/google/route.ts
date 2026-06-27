import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`
  )
}

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get('return_to') ?? '/dashboard/orders/import/google-sheet'

  const oauth2 = oauthClient()
const url = oauth2.generateAuthUrl({
  access_type: 'online',
  prompt: 'consent',
  scope: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
  ],
  state: encodeURIComponent(returnTo),
})

  return NextResponse.redirect(url)
}
