import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

const MAX_ROWS = 1000

interface ImportRow {
  name:            string
  sku:             string
  price:           string
  brand?:          string | null
  compare_price?:  string | null
  barcode?:        string | null
  is_active?:      string | null
  weight_g?:       string | null
  confirmer_notes?: string | null
}

interface RowError { row: number; reason: string }

function parseBoolean(val: string | null | undefined): boolean {
  if (!val) return true
  const v = val.trim().toLowerCase()
  return !['non', 'no', 'false', 'faux', '0', 'inactif'].includes(v)
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req)
  const body = await req.json() as { rows: ImportRow[]; boutique_id?: string }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'rows est requis' }, { status: 400 })
  }
  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} lignes par import` }, { status: 400 })
  }

  const boutiqueId = body.boutique_id?.trim() || null

  // Pre-fetch existing SKUs for this tenant to detect duplicates
  const { data: existingSkuRows } = await db
    .from('products')
    .select('sku')
    .eq('tenant_id', user.tenantId)
    .is('deleted_at', null)

  const existingSkus = new Set(
    (existingSkuRows ?? []).map((p: { sku: string }) => p.sku.toLowerCase())
  )

  // Track SKUs inserted in this import run (catches within-file duplicates)
  const insertedSkus = new Set<string>()

  // Brand name → id cache (auto-create if not found)
  const brandCache = new Map<string, string>()

  let imported = 0
  const errors: RowError[] = []

  for (let i = 0; i < body.rows.length; i++) {
    const row    = body.rows[i]
    const rowNum = i + 2 // row 1 = header, row 2 = first data row

    // ── Required field validation ─────────────────────────────────────────────
    const name  = row.name?.trim()
    const sku   = row.sku?.trim()
    const price = parseFloat(row.price ?? '')

    if (!name)            { errors.push({ row: rowNum, reason: 'Nom du produit manquant' });  continue }
    if (!sku)             { errors.push({ row: rowNum, reason: 'SKU manquant' });              continue }
    if (isNaN(price) || price <= 0) {
      errors.push({ row: rowNum, reason: 'Prix invalide (doit être un nombre > 0)' }); continue
    }

    // ── SKU uniqueness ────────────────────────────────────────────────────────
    const skuLower = sku.toLowerCase()
    if (existingSkus.has(skuLower) || insertedSkus.has(skuLower)) {
      errors.push({ row: rowNum, reason: `SKU en double : "${sku}"` }); continue
    }

    // ── Compare price ─────────────────────────────────────────────────────────
    const comparePrice = row.compare_price ? parseFloat(row.compare_price) : null
    if (comparePrice !== null && (isNaN(comparePrice) || comparePrice <= price)) {
      errors.push({ row: rowNum, reason: 'Le prix comparé doit être supérieur au prix de vente' }); continue
    }

    // ── Brand lookup / auto-create ────────────────────────────────────────────
    let brandId: string | null = null
    const brandName = row.brand?.trim()
    if (brandName) {
      const cacheKey = brandName.toLowerCase()
      if (brandCache.has(cacheKey)) {
        brandId = brandCache.get(cacheKey)!
      } else {
        const { data: existingBrand } = await db
          .from('brands')
          .select('id')
          .eq('tenant_id', user.tenantId)
          .ilike('name', brandName)
          .limit(1)
          .maybeSingle()

        if (existingBrand) {
          brandId = existingBrand.id
        } else {
          // Auto-create brand
          const newBrandId = uuid()
          const { error: bErr } = await db.from('brands').insert({
            id: newBrandId, tenant_id: user.tenantId, name: brandName,
          })
          if (!bErr) brandId = newBrandId
        }
        if (brandId) brandCache.set(cacheKey, brandId)
      }
    }

    // ── Insert product ────────────────────────────────────────────────────────
    const productId = uuid()

    const { error: insErr } = await db.from('products').insert({
      id:              productId,
      tenant_id:       user.tenantId,
      name,
      sku,
      barcode:         row.barcode?.trim() || null,
      brand_id:        brandId,
      price,
      compare_price:   comparePrice,
      is_active:       parseBoolean(row.is_active),
      weight_g:        row.weight_g ? parseFloat(row.weight_g) || null : null,
      confirmer_notes: row.confirmer_notes?.trim() || null,
      out_of_stock_behavior: 'allow',
      stock_alert_enabled:   false,
      stock_strategy:        'fifo',
    })

    if (insErr) {
      errors.push({ row: rowNum, reason: insErr.message })
      continue
    }

    insertedSkus.add(skuLower)

    // ── Assign to boutique ────────────────────────────────────────────────────
    if (boutiqueId) {
      await db.from('product_boutiques').insert({
        product_id: productId, boutique_id: boutiqueId,
      })
    }

    imported++
  }

  return NextResponse.json({ imported, failed: errors.length, errors })
}
