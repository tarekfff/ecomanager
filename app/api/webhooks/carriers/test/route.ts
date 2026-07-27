import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { getAdapter } from '@/lib/carriers'
import type { CarrierCreds } from '@/lib/carriers/types'

// POST — non-destructive connectivity + credential check for a carrier.
// Body: { provider, credentials: { ...adapter.credentialFields } }
export async function POST(req: NextRequest) {
  await requirePermission(req, 'webhooks.create')
  const body = await req.json() as { provider?: string; credentials?: Record<string, unknown> }

  const adapter = getAdapter(body.provider)
  if (!adapter) return NextResponse.json({ ok: false, message: 'Transporteur inconnu' }, { status: 400 })

  const creds: CarrierCreds = {}
  for (const f of adapter.credentialFields) {
    const v = body.credentials?.[f.key]
    const s = typeof v === 'string' ? v.trim() : ''
    if (f.required && !s) return NextResponse.json({ ok: false, message: `Identifiant requis: ${f.key}` }, { status: 400 })
    if (s) creds[f.key] = s
  }

  try {
    const res = await adapter.ping(creds)
    return NextResponse.json(res)
  } catch (e) {
    return NextResponse.json({ ok: false, message: String(e).slice(0, 200) })
  }
}
