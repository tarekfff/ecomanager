import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

// GET — list the saved "livraison société" webhooks available for dispatch.
// These populate the Dispatcher dropdown (en-preparation): choosing one dispatches
// the order to that société and fires its saved webhook configuration.
export async function GET(req: NextRequest) {
  const user       = requireAuth(req)
  const boutiqueId = (req.nextUrl.searchParams.get('boutique_id') ?? '').trim()

  const { data, error } = await db
    .from('webhooks')
    .select('id, name, url, boutique_ids')
    .eq('tenant_id', user.tenantId)
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const options = ((data ?? []) as { id: string; name: string; url: string; boutique_ids: string[] | null }[])
    // Webhook applies to this boutique (empty list = all boutiques)
    .filter(w => !boutiqueId || !w.boutique_ids?.length || w.boutique_ids.includes(boutiqueId))
    .map(w => ({
      id:       w.id,
      name:     w.name,
      kind:     /noest-dz\.com/i.test(w.url) ? 'noest' : 'api',
    }))

  return NextResponse.json(options)
}
