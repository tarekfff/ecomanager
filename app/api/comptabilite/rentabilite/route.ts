import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

// One row per order_item (v_order_facts) for the selected product.
type FactRow = {
  order_id:     string
  boutique_id:  string
  quantity:     number | null
  line_total:   number | null
  unit_cost:    number | null
  delivery_fee: number | null  // order-level (repeated per item row)
  carrier_fee:  number | null  // order-level
  discount:     number | null  // order-level
}

type ConfCfg = { boutique_id: string; cost_amount: number; apply_to: 'each_order' | 'all_orders'; based_on: string }
type PackCfg = { boutique_id: string; cost_amount: number; apply_per: 'order' | 'product'; based_on: string }

const isTrue = (v: string | null) => v === 'true' || v === '1'

export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'accounting.product_profitability')
  const sp   = req.nextUrl.searchParams

  const productId  = (sp.get('product_id')  ?? '').trim()
  const variantId  = (sp.get('variant_id')  ?? '').trim()
  const boutiqueId = (sp.get('boutique_id') ?? '').trim()
  const from       = (sp.get('from')        ?? '').trim()
  const to         = (sp.get('to')          ?? '').trim()

  if (!productId)   return NextResponse.json({ error: 'product_id requis' }, { status: 400 })
  if (!from || !to) return NextResponse.json({ error: 'Période requise' }, { status: 400 })

  const splitRemise   = isTrue(sp.get('split_remise'))
  const splitLivr     = isTrue(sp.get('split_livraison'))
  const splitLivreurs = isTrue(sp.get('split_livreurs'))
  const splitConf     = isTrue(sp.get('split_confirmation'))
  const splitEmb      = isTrue(sp.get('split_emballage'))

  const toTs = to + 'T23:59:59.999Z'

  // Delivered order_items of this product, within the delivery period.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let factsQ: any = db
    .from('v_order_facts')
    .select('order_id,boutique_id,quantity,line_total,unit_cost,delivery_fee,carrier_fee,discount')
    .eq('tenant_id', user.tenantId)
    .eq('product_id', productId)
    .eq('tracking_status', 'livree')
    .gte('delivered_at', from)
    .lte('delivered_at', toTs)

  if (variantId)  factsQ = factsQ.eq('variant_id', variantId)
  if (boutiqueId) factsQ = factsQ.eq('boutique_id', boutiqueId)

  const factsRes = await factsQ
  if (factsRes.error) return NextResponse.json({ error: factsRes.error.message }, { status: 500 })

  const rows = (factsRes.data ?? []) as FactRow[]

  // Aggregate product-level metrics + per-order info (order-level fields counted once).
  type OrderInfo = { boutique_id: string; product_qty: number; delivery_fee: number; carrier_fee: number; discount: number }
  const orders = new Map<string, OrderInfo>()

  let qte_livree = 0, revenue = 0, product_cost = 0
  for (const r of rows) {
    const q = Number(r.quantity ?? 0)
    qte_livree   += q
    revenue      += Number(r.line_total ?? 0)
    product_cost += Number(r.unit_cost ?? 0) * q

    const o = orders.get(r.order_id)
    if (o) {
      o.product_qty += q
    } else {
      orders.set(r.order_id, {
        boutique_id:  r.boutique_id,
        product_qty:  q,
        delivery_fee: Number(r.delivery_fee ?? 0),
        carrier_fee:  Number(r.carrier_fee  ?? 0),
        discount:     Number(r.discount     ?? 0),
      })
    }
  }

  const orderIds    = [...orders.keys()]
  const boutiqueIds = [...new Set([...orders.values()].map(o => o.boutique_id))]

  // Total quantity per order (all products) — needed to split order-level charges
  // proportionally onto this product's share of the order.
  const orderTotalQty = new Map<string, number>()
  if (orderIds.length > 0) {
    const { data: itm } = await db
      .from('order_items')
      .select('order_id, quantity')
      .in('order_id', orderIds)
    for (const r of (itm ?? []) as { order_id: string; quantity: number | null }[]) {
      orderTotalQty.set(r.order_id, (orderTotalQty.get(r.order_id) ?? 0) + Number(r.quantity ?? 0))
    }
  }

  // Per-boutique cost configs + total advertising spend overlapping the period.
  const [confRes, packRes, pubRes, boutiqueQtyRes] = await Promise.all([
    boutiqueIds.length
      ? db.from('confirmation_cost_configs').select('boutique_id, cost_amount, apply_to, based_on').in('boutique_id', boutiqueIds)
      : Promise.resolve({ data: [] as ConfCfg[] }),
    boutiqueIds.length
      ? db.from('packaging_cost_configs').select('boutique_id, cost_amount, apply_per, based_on').in('boutique_id', boutiqueIds)
      : Promise.resolve({ data: [] as PackCfg[] }),
    // Advertising costs for the boutique(s) in scope, overlapping [from, to]
    (boutiqueId
      ? db.from('advertising_costs').select('amount').eq('boutique_id', boutiqueId)
      : db.from('advertising_costs').select('amount').eq('tenant_id', user.tenantId)
    ).lte('period_start', to).gte('period_end', from),
    // Total delivered quantity across ALL products in the boutique(s) over the period
    // — denominator for ad-cost-per-unit.
    (() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = db.from('v_order_facts')
        .select('quantity')
        .eq('tenant_id', user.tenantId)
        .eq('tracking_status', 'livree')
        .gte('delivered_at', from)
        .lte('delivered_at', toTs)
      if (boutiqueId) q = q.eq('boutique_id', boutiqueId)
      return q
    })(),
  ])

  const confByBoutique = new Map<string, ConfCfg>()
  for (const c of ((confRes.data ?? []) as ConfCfg[])) confByBoutique.set(c.boutique_id, c)
  const packByBoutique = new Map<string, PackCfg>()
  for (const p of ((packRes.data ?? []) as PackCfg[])) packByBoutique.set(p.boutique_id, p)

  // Allocate order-level charges onto this product.
  let alloc_remise = 0, alloc_livraison = 0, alloc_livreurs = 0, alloc_conf = 0, alloc_emb = 0
  for (const [orderId, o] of orders) {
    const totalQty = orderTotalQty.get(orderId)
    const share = totalQty && totalQty > 0 ? o.product_qty / totalQty : 1

    if (splitRemise)   alloc_remise    += o.discount     * share
    if (splitLivr)     alloc_livraison += o.delivery_fee * share
    if (splitLivreurs) alloc_livreurs  += o.carrier_fee  * share

    if (splitConf) {
      const cfg = confByBoutique.get(o.boutique_id)
      // Only per-order ("each_order") confirmation cost is attributable to a product.
      if (cfg && cfg.apply_to === 'each_order') alloc_conf += Number(cfg.cost_amount) * share
    }

    if (splitEmb) {
      const cfg = packByBoutique.get(o.boutique_id)
      if (cfg) {
        alloc_emb += cfg.apply_per === 'product'
          ? Number(cfg.cost_amount) * o.product_qty   // already per this product's units
          : Number(cfg.cost_amount) * share
      }
    }
  }

  // delivery_fee is money collected (income); carrier_fee / remise / conf / emballage are costs.
  const benefice_total =
    revenue
    - product_cost
    - alloc_remise
    + alloc_livraison
    - alloc_livreurs
    - alloc_conf
    - alloc_emb

  const benefice_unitaire = qte_livree > 0 ? benefice_total / qte_livree : 0

  // Ad cost per delivered unit (boutique-wide spend ÷ all delivered units in boutique).
  const total_pub = ((pubRes.data ?? []) as { amount: number | null }[])
    .reduce((s, r) => s + Number(r.amount ?? 0), 0)
  const boutiqueQty = ((boutiqueQtyRes.data ?? []) as { quantity: number | null }[])
    .reduce((s, r) => s + Number(r.quantity ?? 0), 0)
  const cout_pub_unitaire = boutiqueQty > 0 ? total_pub / boutiqueQty : 0

  // ROI = profit relative to purchase cost of goods sold (marge sur coût d'achat).
  const roi = product_cost > 0 ? (benefice_total / product_cost) * 100 : 0

  return NextResponse.json({
    benefice_total,
    qte_livree,
    benefice_unitaire,
    cout_pub_unitaire,
    roi,
  })
}
