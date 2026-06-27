import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { noestGetLabelResponse } from '@/lib/noest'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const user   = requireAuth(req)
  const { id } = await params

  // Verify tenant ownership
  const { data: order } = await db
    .from('orders')
    .select('boutique_id, reference')
    .eq('id', id)
    .single()

  if (!order) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const { data: boutique } = await db
    .from('boutiques')
    .select('id')
    .eq('id', (order as { boutique_id: string }).boutique_id)
    .eq('tenant_id', user.tenantId)
    .single()

  if (!boutique) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  // Get NOEST tracking from order_logs
  const { data: noestLog } = await db
    .from('order_logs')
    .select('new_values')
    .eq('order_id', id)
    .eq('action', 'noest_push')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const noestTracking = (noestLog?.new_values as { noest_tracking?: string } | null)?.noest_tracking

  if (!noestTracking) {
    return NextResponse.json({ error: 'Aucun tracking NOEST pour cette commande' }, { status: 404 })
  }

  // Proxy the NOEST label PDF
  const noestRes = await noestGetLabelResponse(noestTracking)

  if (!noestRes.ok) {
    return NextResponse.json({ error: 'Erreur lors du téléchargement de l\'étiquette NOEST' }, { status: 502 })
  }

  const ref = (order as { boutique_id: string; reference: string }).reference
  const pdfBuffer = await noestRes.arrayBuffer()

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="etiquette-${ref}-${noestTracking}.pdf"`,
    },
  })
}
