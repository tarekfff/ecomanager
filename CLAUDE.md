# ECOMANAGER — COD E-Commerce Platform (Algeria)

## Stack
- Framework: Next.js 15 App Router (frontend + API routes)
- Database:  PostgreSQL via lib/db.ts (query() and queryOne() helpers)
- Auth:      JWT in Authorization header via lib/auth.ts (requireAuth())
- Host:      Vercel (everything) + Supabase (database)

## Brand colors
- Primary:    #BF4C98
- Background: #FFF7F2
- Border:     #E2D8E2

## Folder structure
- app/api/           all API routes (serverless functions)
- app/dashboard/     all dashboard pages
- app/(auth)/login/  login page
- components/layout/ Topbar, Sidebar, StatusBar
- components/dashboard/ charts and widgets
- lib/               db.ts, auth.ts, types.ts

## API route pattern — follow this EXACTLY
Every file in app/api/ must:
1. Call requireAuth(req) FIRST → gets { sub, tenantId, email }
2. Scope ALL queries with tenant_id from user.tenantId
3. Return NextResponse.json(data) or NextResponse.json({error}, {status:4xx})

Example:
  import { NextRequest, NextResponse } from 'next/server'
  import { requireAuth } from '@/lib/auth'
  import { query } from '@/lib/db'

  export async function GET(req: NextRequest) {
    const user = requireAuth(req)
    const rows = await query(
      'SELECT * FROM orders o
       JOIN boutiques b ON b.id = o.boutique_id
       WHERE b.tenant_id = $1 AND o.deleted_at IS NULL
       ORDER BY o.created_at DESC',
      [user.tenantId]
    )
    return NextResponse.json(rows)
  }

## Rules
- ALWAYS filter by tenant_id — never cross-tenant data
- Use query() / queryOne() from lib/db.ts only
- French UI labels everywhere
- UUID primary keys
- Soft deletes: WHERE deleted_at IS NULL on orders and products
- Schema is FINAL in migrations/ — never ALTER or CREATE tables
- synchronize: false — never let any ORM touch the schema

## Database key tables
tenants, boutiques, users, roles,
clients, products, product_variants, option_types, option_values,
orders, order_items, order_logs, sav_items, receipts, pickups,
stock_batches, stock_movements, carriers,
wilayas (58 rows seeded), communes,
webhooks, import_sources, expense_types, expenses

## Order references
Call DB function: SELECT generate_order_reference($1)
with boutique_id — never generate manually

## RBAC
roles.permissions JSONB: {"orders.en_confirmation.confirm": true}
Super Admin: {"*": true} — wildcard beats all
Check: permissions["*"] OR permissions[key] === true
