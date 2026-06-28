import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { noestGetDesks, noestGetFees, noestGetCommunes, noestGetWilayas } from '@/lib/noest'

// GET /api/noest/reference?type=desks|fees|communes|wilayas[&wilaya_id=5]
// Read-only NOEST reference data (PDF §12–15). Useful for stop-desk station codes,
// delivery-fee grids, deliverable communes and the wilaya list.
export async function GET(req: NextRequest) {
  requireAuth(req)
  const sp   = req.nextUrl.searchParams
  const type = (sp.get('type') ?? '').trim()

  try {
    switch (type) {
      case 'desks':
        return NextResponse.json(await noestGetDesks())
      case 'fees':
        return NextResponse.json(await noestGetFees())
      case 'communes': {
        const wRaw = sp.get('wilaya_id')
        const w    = wRaw ? parseInt(wRaw, 10) : undefined
        return NextResponse.json(await noestGetCommunes(Number.isFinite(w) ? w : undefined))
      }
      case 'wilayas':
        return NextResponse.json(await noestGetWilayas())
      default:
        return NextResponse.json({ error: 'type invalide (desks|fees|communes|wilayas)' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }
}
