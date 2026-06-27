import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

type FactRow = {
  order_id:         string
  subtotal:         number | null
  delivery_fee:     number | null
  carrier_fee:      number | null
  discount:         number | null
  items_cost:       number | null
  sav_cost:         number | null
  tracking_status:  string | null
  confirmed_at:     string | null
}

type AmountRow = { amount: number | null }

export async function GET(req: NextRequest) {
  const user = requireAuth(req)
  const sp   = req.nextUrl.searchParams

  const boutiqueId = (sp.get('boutique_id') ?? '').trim()
  const from       = (sp.get('from')         ?? '').trim()
  const to         = (sp.get('to')           ?? '').trim()
  const dateBasis  = (sp.get('date_basis')   ?? 'created_at').trim()
  const base       = (sp.get('base')         ?? 'confirmed').trim()

  if (!boutiqueId) return NextResponse.json({ error: 'boutique_id requis' }, { status: 400 })
  if (!from || !to) return NextResponse.json({ error: 'Période requise' }, { status: 400 })

  const dateCol = dateBasis === 'delivered_at' ? 'delivered_at' : 'created_at'
  const toTs    = to + 'T23:59:59.999Z'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let factsQ: any = db
    .from('v_bilan_facts')
    .select('order_id,subtotal,delivery_fee,carrier_fee,discount,items_cost,sav_cost,tracking_status,confirmed_at')
    .eq('tenant_id', user.tenantId)
    .eq('boutique_id', boutiqueId)
    .gte(dateCol, from)
    .lte(dateCol, toTs)

  if (base === 'confirmed') factsQ = factsQ.not('confirmed_at', 'is', null)
  if (base === 'delivered') factsQ = factsQ.eq('tracking_status', 'livree')

  const [factsRes, confCfgRes, packCfgRes, pubRes, monthlyExpRes, periodExpRes] = await Promise.all([
    factsQ,
    db.from('confirmation_cost_configs').select('*').eq('boutique_id', boutiqueId).maybeSingle(),
    db.from('packaging_cost_configs').select('*').eq('boutique_id', boutiqueId).maybeSingle(),
    db.from('advertising_costs')
      .select('amount')
      .eq('boutique_id', boutiqueId)
      .lte('period_start', to)
      .or(`period_end.is.null,period_end.gte.${from}`),
    db.from('expenses')
      .select('amount')
      .eq('boutique_id', boutiqueId)
      .eq('period_type', 'monthly'),
    db.from('expenses')
      .select('amount')
      .eq('boutique_id', boutiqueId)
      .neq('period_type', 'monthly')
      .gte('period_start', from)
      .lte('period_start', to),
  ])

  if (factsRes.error) return NextResponse.json({ error: factsRes.error.message }, { status: 500 })

  const rows = (factsRes.data ?? []) as FactRow[]

  let ca = 0, valeur_achat = 0, remise = 0, frais_recolt = 0, frais_livreurs = 0
  let order_count = 0, delivered_count = 0

  for (const r of rows) {
    ca             += Number(r.subtotal    ?? 0)
    valeur_achat   += Number(r.items_cost  ?? 0) + Number(r.sav_cost ?? 0)
    remise         += Number(r.discount    ?? 0)
    frais_recolt   += Number(r.delivery_fee  ?? 0)
    frais_livreurs += Number(r.carrier_fee   ?? 0)
    order_count++
    if (r.tracking_status === 'livree') delivered_count++
  }

  // Packaging per-product: fetch total item quantity from order_items
  let item_qty = 0
  const packCfg = packCfgRes.data
  if (packCfg?.apply_per === 'product' && rows.length > 0) {
    const orderIds = rows.map(r => r.order_id).filter(Boolean)
    const { data: itmData } = await db
      .from('order_items')
      .select('quantity')
      .in('order_id', orderIds)
    item_qty = ((itmData ?? []) as { quantity: number | null }[])
      .reduce((s, r) => s + Number(r.quantity ?? 0), 0)
  }

  const pub_from_db = ((pubRes.data ?? []) as AmountRow[])
    .reduce((s, r) => s + Number(r.amount ?? 0), 0)

  const autres_charges = [
    ...((monthlyExpRes.data ?? []) as AmountRow[]),
    ...((periodExpRes.data  ?? []) as AmountRow[]),
  ].reduce((s, r) => s + Number(r.amount ?? 0), 0)

  return NextResponse.json({
    aggregates: {
      ca,
      valeur_achat,
      remise,
      frais_recolt,
      frais_livreurs,
      order_count,
      delivered_count,
      item_qty,
    },
    configs: {
      pub_from_db,
      autres_charges,
      confirmation: confCfgRes.data ?? null,
      packaging:    packCfg ?? null,
    },
  })
}
