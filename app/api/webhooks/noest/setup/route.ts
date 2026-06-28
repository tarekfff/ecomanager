import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'
import { noestPing } from '@/lib/noest'

const NOEST_BASE = process.env.NOEST_BASE_URL ?? 'https://app.noest-dz.com'

// POST — ensure a NOEST "livraison société" webhook exists for the tenant.
// Idempotent: returns the existing one if already configured. Also runs a
// read-only connectivity check against the live NOEST API (non-destructive).
export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'webhooks.create')

  // Connectivity check first so the user gets immediate feedback on credentials.
  const ping = await noestPing()

  // Already configured?
  const { data: existing } = await db
    .from('webhooks')
    .select('id, name, event, url, secret, boutique_ids, is_active, created_at')
    .eq('tenant_id', user.tenantId)
    .ilike('url', '%noest-dz.com%')
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ webhook: existing, created: false, ping })
  }

  const { data, error } = await db
    .from('webhooks')
    .insert({
      id:           uuid(),
      tenant_id:    user.tenantId,
      name:         'NOEST (Livraison)',
      event:        'OrderShipped',   // push + validate to NOEST when an order ships
      url:          NOEST_BASE,
      secret:       uuid(),
      boutique_ids: [],               // all boutiques
      is_active:    true,
    })
    .select('id, name, event, url, secret, boutique_ids, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ webhook: data, created: true, ping }, { status: 201 })
}
