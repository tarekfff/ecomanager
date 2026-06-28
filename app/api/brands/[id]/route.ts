import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'brands.edit')
  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const name = (body.name as string | undefined)?.trim()

  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  // Verify ownership
  const { data: existing } = await db
    .from('brands')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Marque introuvable' }, { status: 404 })

  const { data, error } = await db
    .from('brands')
    .update({ name })
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .select('id, name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'brands.delete')
  const { id } = await params

  // Verify ownership
  const { data: existing } = await db
    .from('brands')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Marque introuvable' }, { status: 404 })

  // Block deletion if products are attached to this brand
  const { count } = await db
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', user.tenantId)
    .eq('brand_id', id)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `Impossible de supprimer : ${count} produit(s) sont associés à cette marque.` },
      { status: 409 },
    )
  }

  const { error } = await db
    .from('brands')
    .delete()
    .eq('id', id)
    .eq('tenant_id', user.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
