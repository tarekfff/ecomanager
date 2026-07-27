import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionPrefix } from '@/lib/auth'
import { PROVIDERS } from '@/lib/carriers'

// GET — list the carrier providers + their credential fields, so the Add/Edit
// webhook form can render a provider picker and the right inputs dynamically.
export async function GET(req: NextRequest) {
  await requirePermissionPrefix(req, 'webhooks')
  return NextResponse.json(PROVIDERS)
}
