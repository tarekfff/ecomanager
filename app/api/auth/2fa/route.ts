import { NextRequest, NextResponse } from 'next/server'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// POST — two-step TOTP enrolment.
//  • No `code` in body → generate a secret, store it (NOT yet enabled), return
//    the otpauth URL + a QR-code data URL for the authenticator app.
//  • With `code` → verify the 6-digit TOTP against the stored secret and, on
//    success, flip two_fa_enabled = true.
export async function POST(req: NextRequest) {
  const user = requireAuth(req)
  const body = await req.json().catch(() => ({}))
  const code = (body?.code ?? '').toString().trim()

  // ── Step 2: confirm activation ──────────────────────────────────────────────
  if (code) {
    const { data: row } = await db
      .from('users')
      .select('two_fa_secret')
      .eq('id', user.sub)
      .eq('tenant_id', user.tenantId)
      .single()

    const secret = (row as { two_fa_secret: string | null } | null)?.two_fa_secret
    if (!secret) return NextResponse.json({ error: 'Aucune configuration 2FA en cours' }, { status: 400 })

    const ok = speakeasy.totp.verify({ secret, encoding: 'base32', token: code, window: 1 })
    if (!ok) return NextResponse.json({ error: 'Code invalide' }, { status: 400 })

    const { error } = await db
      .from('users')
      .update({ two_fa_enabled: true })
      .eq('id', user.sub)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ enabled: true })
  }

  // ── Step 1: generate + store a fresh secret ─────────────────────────────────
  const secret = speakeasy.generateSecret({ name: `EcoManager (${user.email})` })

  const { error } = await db
    .from('users')
    .update({ two_fa_secret: secret.base32, two_fa_enabled: false })
    .eq('id', user.sub)
    .eq('tenant_id', user.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const qr = await QRCode.toDataURL(secret.otpauth_url ?? '')
  return NextResponse.json({ otpauth_url: secret.otpauth_url, qr })
}

// DELETE — disable 2FA and clear the stored secret.
export async function DELETE(req: NextRequest) {
  const user = requireAuth(req)

  const { error } = await db
    .from('users')
    .update({ two_fa_enabled: false, two_fa_secret: null })
    .eq('id', user.sub)
    .eq('tenant_id', user.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ enabled: false })
}
