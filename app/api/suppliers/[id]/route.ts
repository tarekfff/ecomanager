import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'suppliers.edit')
  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const name    = (body.name    as string | undefined)?.trim()
  const phone   = (body.phone   as string | undefined)?.trim() || null
  const email   = (body.email   as string | undefined)?.trim() || null
  const address = (body.address as string | undefined)?.trim() || null

  if (!name) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

  // Verify ownership
  const { data: existing } = await db
    .from('suppliers')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })

  const { data, error } = await db
    .from('suppliers')
    .update({ name, phone, email, address })
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .select('id, name, phone, email, address')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = await requirePermission(req, 'suppliers.delete')
  const { id } = await params

  // Verify ownership
  const { data: existing } = await db
    .from('suppliers')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Fournisseur introuvable' }, { status: 404 })

  // Block deletion if stock batches reference this supplier
  const { count } = await db
    .from('stock_batches')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', user.tenantId)
    .eq('supplier_id', id)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `Impossible de supprimer : ${count} lot(s) de stock sont associés à ce fournisseur.` },
      { status: 409 },
    )
  }

  const { error } = await db
    .from('suppliers')
    .delete()
    .eq('id', id)
    .eq('tenant_id', user.tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
