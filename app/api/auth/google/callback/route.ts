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
  const sp      = req.nextUrl.searchParams
  const code    = sp.get('code')
  const state   = sp.get('state') ?? ''
  const error   = sp.get('error')

  const returnTo = decodeURIComponent(state) || '/dashboard/orders/import/google-sheet'

  if (error || !code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${returnTo}?google_error=${encodeURIComponent(error ?? 'no_code')}`
    )
  }

  try {
    const oauth2 = oauthClient()
    const { tokens } = await oauth2.getToken(code)
    oauth2.setCredentials(tokens)

    // Get connected account email
    const info = google.oauth2({ version: 'v2', auth: oauth2 })
    const { data: userInfo } = await info.userinfo.get()

    const accessToken  = tokens.access_token  ?? ''
    const refreshToken = tokens.refresh_token ?? ''
    const email        = userInfo.email       ?? ''

    const redirectUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}${returnTo}`)
    redirectUrl.searchParams.set('google_token',         accessToken)
    redirectUrl.searchParams.set('google_refresh_token', refreshToken)
    redirectUrl.searchParams.set('google_email',         email)

    return NextResponse.redirect(redirectUrl.toString())
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${returnTo}?google_error=${encodeURIComponent(msg)}`
    )
  }
}
