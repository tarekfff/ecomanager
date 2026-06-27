import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user       = requireAuth(req)
  const boutiqueId = req.nextUrl.searchParams.get('boutique_id')?.trim() ?? ''

  if (!boutiqueId) return NextResponse.json({ error: 'boutique_id requis' }, { status: 400 })

  // Verify boutique belongs to tenant
  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', boutiqueId)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!boutique) return NextResponse.json({ error: 'Boutique introuvable' }, { status: 403 })

  // Get carrier IDs linked to this boutique
  const { data: cbRows } = await db
    .from('carrier_boutiques')
    .select('carrier_id')
    .eq('boutique_id', boutiqueId)

  const carrierIds = ((cbRows ?? []) as { carrier_id: string }[]).map(r => r.carrier_id)
  if (carrierIds.length === 0) return NextResponse.json([])

  const { data, error } = await db
    .from('carriers')
    .select('id, name, phone, platform, is_active')
    .in('id', carrierIds)
    .eq('tenant_id', user.tenantId)
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json((data ?? []).map((c: any) => ({
    id:       c.id,
    name:     c.name,
    phone:    c.phone,
    platform: c.platform,
  })))
}
