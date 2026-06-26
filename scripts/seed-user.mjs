import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { WebSocket } from 'ws'
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket

const SUPABASE_URL      = 'https://igfeellkxupmtvxxlovh.supabase.co'
const SERVICE_ROLE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnZmVlbGxreHVwbXR2eHhsb3ZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjQ4NzY2MCwiZXhwIjoyMDk4MDYzNjYwfQ.2NIoHyylieMvn75KnKNZJi8UEvj-I2dqF9aTVz9-DpQ'

// ── Credentials for the test account ──────────────────────────
const USER_EMAIL    = 'admin@ecomanager.dz'
const USER_PASSWORD = 'Admin123!'
const USER_NAME     = 'Super Admin'
const TENANT_NAME   = 'Demo Store'
const BOUTIQUE_NAME = 'Boutique Principale'
// ──────────────────────────────────────────────────────────────

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch },
})

async function main() {
  console.log('Starting seed...\n')

  // 1. Check if user already exists
  const { data: existing } = await db
    .from('users')
    .select('id, email')
    .eq('email', USER_EMAIL)
    .maybeSingle()

  if (existing) {
    console.log(`✓ User already exists: ${existing.email} (id: ${existing.id})`)
    console.log('\nLogin credentials:')
    console.log(`  Email:    ${USER_EMAIL}`)
    console.log(`  Password: ${USER_PASSWORD}`)
    return
  }

  // 2. Create tenant
  const tenantId = randomUUID()
  const { error: tenantErr } = await db
    .from('tenants')
    .insert({ id: tenantId, name: TENANT_NAME, slug: 'demo-store', plan: 'pro', is_active: true })
  if (tenantErr) throw new Error(`Tenant: ${tenantErr.message}`)
  console.log(`✓ Tenant created: ${TENANT_NAME} (${tenantId})`)

  // 3. Seed tenant defaults (statuses, warehouse, Super Admin role)
  const { error: seedErr } = await db.rpc('seed_tenant_defaults', { p_tenant_id: tenantId })
  if (seedErr) throw new Error(`Seed defaults: ${seedErr.message}`)
  console.log('✓ Tenant defaults seeded (statuses, warehouse, Super Admin role)')

  // 4. Create user
  const userId      = randomUUID()
  const passwordHash = await bcrypt.hash(USER_PASSWORD, 12)
  const { error: userErr } = await db
    .from('users')
    .insert({
      id:            userId,
      tenant_id:     tenantId,
      name:          USER_NAME,
      email:         USER_EMAIL,
      password_hash: passwordHash,
      email_verified: true,
      is_active:     true,
    })
  if (userErr) throw new Error(`User: ${userErr.message}`)
  console.log(`✓ User created: ${USER_EMAIL}`)

  // 5. Assign Super Admin role
  const { data: role, error: roleErr } = await db
    .from('roles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', 'Super Admin')
    .single()
  if (roleErr || !role) throw new Error('Super Admin role not found after seed')

  const { error: urErr } = await db
    .from('user_roles')
    .insert({ user_id: userId, role_id: role.id })
  if (urErr) throw new Error(`User role: ${urErr.message}`)
  console.log('✓ Super Admin role assigned')

  // 6. Create boutique
  const boutiqueId = randomUUID()
  const { error: boutErr } = await db
    .from('boutiques')
    .insert({ id: boutiqueId, tenant_id: tenantId, name: BOUTIQUE_NAME, prefix: 'CMD', is_active: true })
  if (boutErr) throw new Error(`Boutique: ${boutErr.message}`)
  console.log(`✓ Boutique created: ${BOUTIQUE_NAME}`)

  // 7. Assign user to boutique
  const { error: ubErr } = await db
    .from('user_boutiques')
    .insert({ user_id: userId, boutique_id: boutiqueId })
  if (ubErr) throw new Error(`User boutique: ${ubErr.message}`)
  console.log('✓ User assigned to boutique')

  console.log('\n✅ Done! Login credentials:')
  console.log(`   Email:    ${USER_EMAIL}`)
  console.log(`   Password: ${USER_PASSWORD}`)
  console.log(`   URL:      http://localhost:3000/login`)
}

main().catch(err => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
