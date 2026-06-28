import { NextRequest, NextResponse } from 'next/server'
import { authWithPermissions, assertPermission } from '@/lib/auth'
import { db } from '@/lib/db'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, perms } = await authWithPermissions(req)
  const { id } = await params

  // Verify the receipt belongs to this tenant via orders → boutiques
  const { data: receipt } = await db
    .from('receipts')
    .select('id, status, type, orders!inner(boutiques!inner(tenant_id))')
    .eq('id', id)
    .single()

  if (!receipt) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyR = receipt as any
  const boutiques = anyR.orders?.boutiques
  const tid = Array.isArray(boutiques) ? boutiques[0]?.tenant_id : boutiques?.tenant_id
  if (tid !== user.tenantId) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // Removing a prepared bon = go_back on the matching bon section
  assertPermission(perms, anyR.type === 'retour' ? 'orders.bon_retour.go_back' : 'orders.bon_encaissement.go_back')

  if (anyR.status === 'confirmed') {
    return NextResponse.json({ error: 'Un bon confirmé ne peut pas être supprimé' }, { status: 409 })
  }

  const { error } = await db.from('receipts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}
