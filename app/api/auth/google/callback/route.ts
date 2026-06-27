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
    console.log(tokens)
    oauth2.setCredentials(tokens)

    // Get connected account email
    const people = google.oauth2({ version: 'v2', auth: oauth2 })
    const { data: userInfo } = await people.userinfo.get()

    const accessToken  = tokens.access_token  ?? ''
    const email        = userInfo.email        ?? ''

    // Pass tokens back to the client via URL fragment — never exposed to server logs
    const redirectUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL}${returnTo}`)
    redirectUrl.searchParams.set('google_token', accessToken)
    redirectUrl.searchParams.set('google_email', email)

    return NextResponse.redirect(redirectUrl.toString())
} catch (err: any) {
  console.error("==== GOOGLE TOKEN ERROR ====");
  console.error(err);

  if (err.response) {
    console.error(err.response.data);
  }

  return NextResponse.json(
    {
      error: err.response?.data ?? err.message ?? String(err),
    },
    { status: 500 }
  );
}
}
