import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/auth'
import { db } from '@/lib/db'

const DATE_FIELD_MAP: Record<string, string> = {
  created:    'created_at',
  assigned:   'assigned_at',
  confirmed:  'confirmed_at',
  dispatched: 'dispatched_at',
  shipped:    'shipped_at',
  delivered:  'delivered_at',
  failed:     'failed_at',
  paid:       'paid_at',
  returned:   'returned_at',
  cancelled:  'cancelled_at',
}

const DIM_FIELDS: Record<string, { id: string; name: string }> = {
  wilaya:    { id: 'wilaya_id',    name: 'wilaya_name' },
  commune:   { id: 'commune_id',   name: 'commune_name' },
  carrier:   { id: 'carrier_id',   name: 'carrier_name' },
  confirmer: { id: 'confirmer_id', name: 'confirmer_name' },
  product:   { id: 'product_id',   name: 'product_name' },
  variant:   { id: 'variant_id',   name: 'variant_sku' },
  boutique:  { id: 'boutique_id',  name: 'boutique_name' },
}

type FactRow = {
  order_id:        string
  tracking_status: string
  quantity:        number
  confirmed_at:    string | null
  [key: string]:   unknown
}

export async function GET(req: NextRequest) {
  const user = await requireAnyPermission(req, ['stats.boutique','stats.product','stats.delivery','stats.confirmation','stats.order'])
  const sp   = req.nextUrl.searchParams

  const dimension   = (sp.get('dimension')    ?? 'wilaya').trim()
  const boutiqueId  = (sp.get('boutique_id')  ?? '').trim()
  const from        = (sp.get('from')         ?? '').trim()
  const to          = (sp.get('to')           ?? '').trim()
  const base        = (sp.get('base')         ?? 'all').trim()
  const dateField   = (sp.get('date_field')   ?? 'created').trim()
  const resultBy    = (sp.get('result_by')    ?? 'count').trim()
  const productId   = (sp.get('product_id')   ?? '').trim()
  const variantId   = (sp.get('variant_id')   ?? '').trim()
  const confirmerId = (sp.get('confirmer_id') ?? '').trim()
  const carrierId   = (sp.get('carrier_id')   ?? '').trim()
  const wilayaId    = (sp.get('wilaya_id')    ?? '').trim()
  const communeId   = (sp.get('commune_id')   ?? '').trim()

  const dim     = DIM_FIELDS[dimension] ?? DIM_FIELDS.wilaya
  const dateCol = DATE_FIELD_MAP[dateField] ?? 'created_at'

  // Minimal column selection to keep payload small
  const extraCols = dim.name !== dim.id ? `,${dim.name}` : ''
  const selectCols = `order_id,tracking_status,quantity,${dim.id}${extraCols}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = db
    .from('v_order_facts')
    .select(selectCols)
    .eq('tenant_id', user.tenantId)

  if (boutiqueId)  query = query.eq('boutique_id', boutiqueId)
  if (base === 'confirmed') query = query.not('confirmed_at', 'is', null)
  if (from)        query = query.gte(dateCol, from)
  if (to)          query = query.lte(dateCol, to + 'T23:59:59.999Z')
  if (productId)   query = query.eq('product_id', productId)
  if (variantId)   query = query.eq('variant_id', variantId)
  if (confirmerId) query = query.eq('confirmer_id', confirmerId)
  if (carrierId)   query = query.eq('carrier_id', carrierId)
  if (wilayaId)    query = query.eq('wilaya_id', wilayaId)
  if (communeId)   query = query.eq('commune_id', communeId)

  const { data, error } = await query.limit(50000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as FactRow[]

  // Aggregate by (dimensionId, tracking_status) in JS
  type DimEntry = {
    label:      string
    orderSets:  Map<string, Set<string>>  // status → distinct order_ids
    qtySums:    Map<string, number>        // status → sum of quantity
  }
  const dimMap = new Map<string, DimEntry>()

  for (const row of rows) {
    const rawId    = row[dim.id]
    const dimId    = rawId != null ? String(rawId) : '—'
    const rawLabel = dim.name !== dim.id ? row[dim.name] : rawId
    const dimLabel = rawLabel != null ? String(rawLabel) : '—'
    const status   = row.tracking_status ?? 'unknown'

    if (!dimMap.has(dimId)) {
      dimMap.set(dimId, { label: dimLabel, orderSets: new Map(), qtySums: new Map() })
    }
    const entry = dimMap.get(dimId)!

    if (!entry.orderSets.has(status)) entry.orderSets.set(status, new Set())
    entry.orderSets.get(status)!.add(row.order_id)
    entry.qtySums.set(status, (entry.qtySums.get(status) ?? 0) + Number(row.quantity ?? 0))
  }

  const result = Array.from(dimMap.entries()).map(([dimId, entry]) => {
    const counts: Record<string, number> = {}
    let total = 0

    for (const [status, orderSet] of entry.orderSets.entries()) {
      const val = resultBy === 'count'
        ? orderSet.size
        : (entry.qtySums.get(status) ?? 0)
      counts[status] = val
      total += val
    }

    return { dimId, dimLabel: entry.label, counts, total }
  })

  result.sort((a, b) => b.total - a.total)

  return NextResponse.json({ rows: result })
}
