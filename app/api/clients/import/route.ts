import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { v4 as uuid } from 'uuid'

const MAX_ROWS = 1000

interface ImportRow {
  full_name:    string
  phone:        string
  phone2?:      string | null
  email?:       string | null
  wilaya_name:  string
  commune_name: string
  address?:     string | null
}

interface RowError { row: number; reason: string }

export async function POST(req: NextRequest) {
  const user = requireAuth(req)
  const body = await req.json() as { rows: ImportRow[] }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'rows est requis' }, { status: 400 })
  }
  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} lignes par import` }, { status: 400 })
  }

  // Caches to avoid duplicate lookups within the same import
  const wilayaCache  = new Map<string, number>()
  const communeCache = new Map<string, number | null>()

  let imported = 0
  const errors: RowError[] = []

  for (let i = 0; i < body.rows.length; i++) {
    const row    = body.rows[i]
    const rowNum = i + 2 // +2 so row numbers match the spreadsheet (1=header, 2=first data row)

    const full_name = row.full_name?.trim()
    const phone     = row.phone?.trim()

    if (!full_name) { errors.push({ row: rowNum, reason: 'Nom complet manquant' }); continue }
    if (!phone)     { errors.push({ row: rowNum, reason: 'Téléphone manquant' });   continue }

    // ── Resolve wilaya ────────────────────────────────────────────────────────
    let wilayaId: number | null = null
    const wilayaName = row.wilaya_name?.trim()
    if (wilayaName) {
      const cacheKey = wilayaName.toLowerCase()
      if (wilayaCache.has(cacheKey)) {
        wilayaId = wilayaCache.get(cacheKey)!
      } else {
        const { data } = await db
          .from('wilayas')
          .select('id')
          .ilike('name', wilayaName)
          .limit(1)
          .maybeSingle()
        if (!data) {
          errors.push({ row: rowNum, reason: `Wilaya introuvable : "${wilayaName}"` })
          continue
        }
        wilayaId = data.id
        wilayaCache.set(cacheKey, data.id)
      }
    }

    // ── Resolve commune (soft — skip if not found, keep wilaya) ───────────────
    let communeId: number | null = null
    const communeName = row.commune_name?.trim()
    if (communeName && wilayaId) {
      const cacheKey = `${wilayaId}:${communeName.toLowerCase()}`
      if (communeCache.has(cacheKey)) {
        communeId = communeCache.get(cacheKey) ?? null
      } else {
        const { data } = await db
          .from('communes')
          .select('id')
          .eq('wilaya_id', wilayaId)
          .ilike('name', communeName)
          .limit(1)
          .maybeSingle()
        communeId = data?.id ?? null
        communeCache.set(cacheKey, communeId)
      }
    }

    // ── Insert client ─────────────────────────────────────────────────────────
    const { error: insErr } = await db.from('clients').insert({
      id:         uuid(),
      tenant_id:  user.tenantId,
      full_name,
      phone,
      phone2:     row.phone2?.trim()  || null,
      email:      row.email?.trim()   || null,
      address:    row.address?.trim() || null,
      wilaya_id:  wilayaId,
      commune_id: communeId,
    })

    if (insErr) {
      errors.push({ row: rowNum, reason: insErr.message })
    } else {
      imported++
    }
  }

  return NextResponse.json({ imported, failed: errors.length, errors })
}
