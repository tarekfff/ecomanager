import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

const SELECT_FIELDS =
  'id, name, phone, platform, wilaya_ids, manages_stock, is_active, carrier_boutiques(boutique_id)'

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params

  const { data, error } = await db
    .from('carriers')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Livreur introuvable' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { carrier_boutiques, ...rest } = data as any
  return NextResponse.json({
    ...rest,
    boutique_ids: (carrier_boutiques ?? []).map((cb: { boutique_id: string }) => cb.boutique_id),
  })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const name          = (body.name     as string | undefined)?.trim()
  const phone         = (body.phone    as string | undefined)?.trim() || null
  const platform      = (body.platform as string | undefined)?.trim() || null
  const wilaya_ids    = Array.isArray(body.wilaya_ids)   ? (body.wilaya_ids   as number[]) : []
  const boutique_ids  = Array.isArray(body.boutique_ids) ? (body.boutique_ids as string[]) : []
  const manages_stock = body.manages_stock === true
  const is_active     = body.is_active !== false

  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  // Verify ownership
  const { data: existing } = await db
    .from('carriers')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Livreur introuvable' }, { status: 404 })

  const { data, error } = await db
    .from('carriers')
    .update({ name, phone, platform, wilaya_ids, manages_stock, is_active })
    .eq('id', id)
    .select('id, name, phone, platform, wilaya_ids, manages_stock, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Re-sync boutique links
  await db.from('carrier_boutiques').delete().eq('carrier_id', id)
  if (boutique_ids.length > 0) {
    await db
      .from('carrier_boutiques')
      .insert(boutique_ids.map(bid => ({ carrier_id: id, boutique_id: bid })))
  }

  return NextResponse.json({ ...data, boutique_ids })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = requireAuth(req)
  const { id } = await params

  // Verify ownership
  const { data: existing } = await db
    .from('carriers')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Livreur introuvable' }, { status: 404 })

  await db.from('carrier_boutiques').delete().eq('carrier_id', id)

  const { error } = await db
    .from('carriers')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
