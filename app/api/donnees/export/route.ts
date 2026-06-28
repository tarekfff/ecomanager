import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

// ── Types ──────────────────────────────────────────────────────────────────

type ExportType = 'orders' | 'clients' | 'products' | 'stock' | 'bilan'
type Format     = 'xlsx' | 'csv'

interface Filters {
  statuses?: string[]
  dateFrom?: string
  dateTo?:   string
}

// Hard cap so a single export can't blow up memory / the function timeout
const MAX_ROWS  = 50_000
const PAGE_SIZE = 1_000

// ── Helpers ────────────────────────────────────────────────────────────────

/** Fetch every row of a query in PAGE_SIZE chunks (Supabase caps at 1000/req). */
async function fetchAll(
  build: () => ReturnType<typeof db.from>,
  applyFilters: (q: ReturnType<typeof db.from>) => unknown,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = applyFilters(build())
    q = q.range(offset, offset + PAGE_SIZE - 1)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Record<string, unknown>[]
    out.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return out
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'data.export')

  const body = await req.json() as {
    type?: ExportType
    boutique_id?: string
    filters?: Filters
    format?: Format
  }

  const type        = body.type
  const boutiqueId  = body.boutique_id?.trim() || ''
  const filters     = body.filters ?? {}
  const format: Format = body.format === 'csv' ? 'csv' : 'xlsx'

  const VALID: ExportType[] = ['orders', 'clients', 'products', 'stock', 'bilan']
  if (!type || !VALID.includes(type)) {
    return NextResponse.json({ error: 'Type de données invalide' }, { status: 400 })
  }

  // If a boutique is selected, verify it belongs to this tenant
  if (boutiqueId) {
    const { data: bt } = await db
      .from('boutiques')
      .select('id')
      .eq('id', boutiqueId)
      .eq('tenant_id', user.tenantId)
      .single()
    if (!bt) return NextResponse.json({ error: 'Boutique introuvable' }, { status: 404 })
  }

  let rows: Record<string, unknown>[] = []
  let sheetName = 'Export'

  try {
    switch (type) {
      case 'orders': {
        sheetName = 'Commandes'
        rows = await fetchAll(
          () => db.from('v_order_facts'),
          (q) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let qq: any = q.select('*').eq('tenant_id', user.tenantId)
            if (boutiqueId) qq = qq.eq('boutique_id', boutiqueId)
            if (filters.statuses && filters.statuses.length > 0) {
              qq = qq.in('tracking_status', filters.statuses)
            }
            if (filters.dateFrom) qq = qq.gte('created_at', filters.dateFrom)
            if (filters.dateTo)   qq = qq.lte('created_at', `${filters.dateTo}T23:59:59`)
            return qq.order('created_at', { ascending: false })
          },
        )
        break
      }

      case 'bilan': {
        sheetName = 'Bilan'
        rows = await fetchAll(
          () => db.from('v_bilan_facts'),
          (q) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let qq: any = q.select('*').eq('tenant_id', user.tenantId)
            if (boutiqueId) qq = qq.eq('boutique_id', boutiqueId)
            if (filters.dateFrom) qq = qq.gte('created_at', filters.dateFrom)
            if (filters.dateTo)   qq = qq.lte('created_at', `${filters.dateTo}T23:59:59`)
            return qq.order('created_at', { ascending: false })
          },
        )
        break
      }

      case 'clients': {
        sheetName = 'Clients'
        rows = await fetchAll(
          () => db.from('clients'),
          (q) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let qq: any = q.select('*').eq('tenant_id', user.tenantId)
            if (filters.dateFrom) qq = qq.gte('created_at', filters.dateFrom)
            if (filters.dateTo)   qq = qq.lte('created_at', `${filters.dateTo}T23:59:59`)
            return qq.order('full_name')
          },
        )
        break
      }

      case 'products': {
        sheetName = 'Produits'
        rows = await fetchAll(
          () => db.from('products'),
          (q) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let qq: any = q.select('*').eq('tenant_id', user.tenantId).is('deleted_at', null)
            return qq.order('name')
          },
        )
        break
      }

      case 'stock': {
        sheetName = 'Stock'
        rows = await fetchAll(
          () => db.from('v_stock_summary'),
          (q) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const qq: any = q.select('*').eq('tenant_id', user.tenantId)
            return qq.order('product_id')
          },
        )
        break
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur lors de la génération'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Build the worksheet — keep an empty sheet (headers absent) if no rows
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const stamp    = new Date().toISOString().slice(0, 10)
  const baseName = `export_${type}_${stamp}`

  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(ws)
    // Prepend BOM so Excel reads UTF-8 (accents) correctly
    const buf = new Uint8Array(Buffer.from('﻿' + csv, 'utf-8'))
    return new NextResponse(buf, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${baseName}.csv"`,
      },
    })
  }

  const buf = new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer)
  return new NextResponse(buf, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
    },
  })
}
