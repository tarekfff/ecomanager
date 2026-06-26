# ECOMANAGER — COD E-Commerce Platform (Algeria)

## Stack
- Framework: Next.js 15 App Router + React 19 (serverless on Vercel)
- Database:  PostgreSQL via Supabase — `lib/db.ts` exports `db` (supabaseAdmin) + `rpc()`. No local pg connection.
- Auth:      Custom JWT — Authorization: Bearer <token>, handled by `lib/auth.ts`
- Styling:   Tailwind CSS v4 (no tailwind.config.js — config lives in globals.css via @theme)
- Host:      Vercel (frontend + API routes) + Supabase (PostgreSQL database)

## Brand colors
- Primary:    #BF4C98
- Background: #FFF7F2
- Border:     #E2D8E2
- Use these in Tailwind v4 via CSS variables defined in globals.css

## UI Design System — ALWAYS follow this
All components use **inline styles** with tokens from `lib/tokens.ts`. Never hardcode color hex strings in components.

```ts
import { colors, fonts, spacing } from '@/lib/tokens'
// colors.primary, colors.bg, colors.border, colors.text, colors.textMd, colors.textLt
// colors.primaryDk (hover), colors.primaryLt (active bg/badge)
// fonts.sans → "'Inter', sans-serif"
// spacing.topbarH=42, spacing.statusbarH=36, spacing.sidebarW=210
```

### Key design rules
- Font: Inter everywhere (`fontFamily: fonts.sans`)
- All font sizes in px (11–14px for UI chrome, 13–15px for content)
- Borders: `1px solid ${colors.border}` (`#E2D8E2`)
- Active sidebar item: `background: colors.primaryLt`, `borderLeft: 3px solid colors.primary`, `color: colors.primary`
- Buttons: `background: colors.primary`, `color: '#fff'`, `borderRadius: 5`, hover → `colors.primaryDk`
- Inputs: `border: 1px solid colors.border`, focus → `borderColor: colors.primary`
- Topbar height: `spacing.topbarH` (42px), `background: colors.primary`
- StatusBar height: `spacing.statusbarH` (36px), `background: '#fff'`
- Sidebar width: `spacing.sidebarW` (210px), `background: '#fff'`
- Main bg: `colors.bg` (`#FFF7F2`)

### Reference components (copy patterns from these)
- `ecomanager-ui-components/components/layout/Topbar.tsx`
- `ecomanager-ui-components/components/layout/Sidebar.tsx`
- `ecomanager-ui-components/components/layout/StatusBar.tsx`
- `ecomanager-ui-components/components/dashboard/DashboardCharts.tsx`
- `ecomanager-ui-components/lib/tokens.ts` (source of truth for tokens)

## Packages available (package.json)
- `@supabase/supabase-js` — Supabase admin client (lib/db.ts). No DATABASE_URL / pg Pool — use `db` from lib/db.ts
- `bcryptjs`      — password hashing
- `jsonwebtoken`  — JWT sign/verify
- `uuid`          — UUID generation (v4)
- `recharts`      — charts (BarChart, PieChart, etc.)
- `xlsx`          — client-side XLS/XLSX/CSV parsing AND template generation (all import wizards)
- `next` 16.2.9, `react` 19, `typescript` 5, `tailwindcss` 4

## Folder structure
```
app/
  (auth)/login/     login page (no layout wrapper)
  api/              all API routes — every file must follow the API pattern below
  dashboard/        all dashboard pages (wrapped in dashboard layout)
  layout.tsx        root layout
  globals.css       Tailwind v4 theme + global styles
components/
  layout/           Topbar, Sidebar, StatusBar
  dashboard/        charts, widgets, stat cards
lib/
  db.ts             query(sql, params) and queryOne(sql, params) — ONLY way to query DB
  auth.ts           requireAuth(req) → { sub, tenantId, email } | throws 401
  types.ts          all shared TypeScript types/interfaces
migrations/         SQL files — READ ONLY, never modify from app code
```

## lib/db.ts — database helper (use EXACTLY like this)
Uses `@supabase/supabase-js` admin client (service_role key) over HTTPS.
No direct PostgreSQL connection needed. RLS is bypassed — always scope by tenant_id manually.

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false }, global: { fetch } }
)

export { supabaseAdmin as db }
export async function rpc<T>(fn: string, params?: Record<string, unknown>): Promise<T>
```

Query pattern in API routes:
```ts
import { db, rpc } from '@/lib/db'

// SELECT (always filter by tenant_id)
const { data, error } = await db
  .from('orders')
  .select('*, order_items(*)')
  .eq('boutique_id', boutiqueId)
  .is('deleted_at', null)
  .order('created_at', { ascending: false })

// INSERT + return created row
const { data, error } = await db
  .from('orders')
  .insert({ boutique_id, client_id, ... })
  .select()
  .single()

// UPDATE
const { data, error } = await db
  .from('orders')
  .update({ tracking_status: 'en_preparation' })
  .eq('id', orderId)
  .select()
  .single()

// Soft delete
await db.from('orders').update({ deleted_at: new Date().toISOString() }).eq('id', id)

// Call a DB function
const ref = await rpc<string>('generate_order_reference', { p_boutique_id: boutiqueId })
await rpc('seed_tenant_defaults', { p_tenant_id: tenantId })

// Query a view (same as a table)
const { data } = await db
  .from('v_order_facts')
  .select('*')
  .eq('tenant_id', user.tenantId)
  .gte('created_at', from)
  .lte('created_at', to)
```

## lib/auth.ts — JWT helper (use EXACTLY like this)
```ts
import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

export interface AuthUser {
  sub:      string   // user UUID
  tenantId: string   // tenant UUID
  email:    string
}

export function requireAuth(req: NextRequest): AuthUser {
  const header = req.headers.get('authorization') ?? ''
  const token  = header.replace('Bearer ', '')
  if (!token) throw new Response('Unauthorized', { status: 401 })
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as AuthUser
  } catch {
    throw new Response('Unauthorized', { status: 401 })
  }
}
```

## API route pattern — follow this EXACTLY
Every file in `app/api/` must:
1. Call `requireAuth(req)` FIRST → gets `{ sub, tenantId, email }`
2. Scope ALL queries with `tenant_id` / `boutique_id` from `user.tenantId`
3. Return `NextResponse.json(data)` or `NextResponse.json({ error }, { status: 4xx })`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = requireAuth(req)

  const { data, error } = await db
    .from('orders')
    .select(`
      id, reference, tracking_status, total, created_at,
      boutiques!inner(tenant_id),
      clients(full_name, phone)
    `)
    .eq('boutiques.tenant_id', user.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

## Import wizard pattern — MANDATORY for every bulk-import feature

Every import page (`app/dashboard/*/import/page.tsx`) must be a 4-step wizard and follow this exact structure. See `app/dashboard/clients/import/page.tsx` as the canonical reference.

### Steps
| Step | Label | What it does |
|------|-------|-------------|
| 1 | Fichier | Drag-and-drop zone + "Parcourir" button. Parses file client-side with `xlsx`. |
| 2 | Correspondance | Preview table (first 5 rows) + column mapping UI (required* and optional fields). |
| 3 | Import | Loading state while POST to `/api/[resource]/import` runs. |
| 4 | Résultat | Summary cards (imported / errors) + collapsible error list. |

### Template download — MANDATORY in step 1

Every import page **must** include a downloadable XLSX template. Users need to know the exact column names and format before uploading. Place it in two spots in step 1:
1. A secondary button next to "Parcourir" labeled **"Télécharger le modèle"**
2. A blue info bar below the drop zone with a description and a prominent download button

```ts
import * as XLSX from 'xlsx'

function downloadTemplate() {
  const templateRows = [
    // Header row — column names must match autoDetect() variants so mapping auto-fills
    ['Nom complet', 'Téléphone', 'Adresse', /* ... other columns */],
    // 2–3 realistic example rows so the user understands the expected format
    ['Ahmed Benali', '0555 12 34 56', 'Rue des Frères Bouadou'],
    ['Fatima Kaci',  '0770 11 22 33', ''],
  ]

  const ws = XLSX.utils.aoa_to_sheet(templateRows)
  ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 36 }]  // one entry per column

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'NomDeLaFeuille')
  XLSX.writeFile(wb, 'modele_import_[resource].xlsx')
}
```

Rules for the template:
- Column header names must exactly match what `autoDetect()` looks for (e.g. `'Nom complet'` not `'nom_complet'`)
- Include 2–3 example rows with realistic Algerian data so users understand the expected format
- Set `!cols` widths so the downloaded file is readable without manual resizing
- File name: `modele_import_[resource].xlsx`

### autoDetect — always include
Each import page needs an `autoDetect(headers)` function that maps common header variants to internal field names. This way, if the user's file already has recognizable column names, the mapping step is pre-filled.

```ts
function autoDetect(headers: string[]): Mapping {
  function find(variants: string[]): string {
    const lower = headers.map(h => h.toLowerCase())
    for (const v of variants) {
      const idx = lower.findIndex(h => h.includes(v))
      if (idx >= 0) return headers[idx]
    }
    return ''
  }
  return {
    field_name: find(['variant1', 'variant2', 'variant3']),
    // ...
  }
}
```

### API route (`app/api/[resource]/import/route.ts`)
```ts
// POST — requireAuth
// Body: { rows: ImportRow[] }
// - Validate required fields per row, collect errors (don't abort on first error)
// - Cache any lookup queries (e.g. wilaya_id by name) with a Map to avoid N+1
// - Hard limit: MAX_ROWS = 1000 per request
// - Return: { imported: number, failed: number, errors: { row: number, reason: string }[] }
// - Row numbers in errors: offset +2 (row 1 = header, row 2 = first data row)
```

## Pagination — MANDATORY for every list endpoint and page

Every list that can grow beyond ~25 rows **must** use server-side pagination. Never load all rows at once.

### Backend (API GET list route)
```ts
const sp     = req.nextUrl.searchParams
const page   = Math.max(1, parseInt(sp.get('page')  ?? '1'))
const limit  = Math.min(100, parseInt(sp.get('limit') ?? '25'))
const search = (sp.get('search') ?? '').trim()
const offset = (page - 1) * limit

const { data, error, count } = await db
  .from('table_name')
  .select('id, col1, col2, ...', { count: 'exact' })   // count:'exact' is required
  .eq('tenant_id', user.tenantId)
  .order('created_at', { ascending: false })
  .range(offset, offset + limit - 1)                   // Supabase pagination

if (error) return NextResponse.json({ error: error.message }, { status: 500 })
return NextResponse.json({ items: data ?? [], total: count ?? 0 })
// ↑ always return both `items` (or a domain-specific name) and `total`
```

- `limit` is capped at 100 server-side — ignore any larger value from the client
- Add filters (search, status, wilaya, etc.) BEFORE `.range()` so the count reflects filtered results
- For text search: `.or('col.ilike.%val%,other_col.ilike.%val%')`

### Frontend (list page)
```ts
const LIMIT = 25   // matches API default; define once as a constant

const [items,    setItems]    = useState<Item[]>([])
const [total,    setTotal]    = useState(0)
const [page,     setPage]     = useState(1)
const [search,   setSearch]   = useState('')      // bound to SearchInput (visual)
const [dbSearch, setDbSearch] = useState('')      // debounced value sent to API
const [loading,  setLoading]  = useState(false)

// Debounce search — reset page to 1 when user types
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
function handleSearchChange(val: string) {
  setSearch(val)
  if (debounceRef.current) clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => { setDbSearch(val); setPage(1) }, 300)
}

// Fetch whenever page or debounced search changes
const fetchItems = useCallback(() => {
  setLoading(true)
  const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT), search: dbSearch })
  fetch(`/api/resource?${qs}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
    .then(r => r.json())
    .then(d => { setItems(d.items ?? []); setTotal(d.total ?? 0) })
    .catch(() => {})
    .finally(() => setLoading(false))
}, [page, dbSearch])

useEffect(() => { fetchItems() }, [fetchItems])

// In JSX — show Pagination only when there are more rows than one page
<SearchInput value={search} onChange={handleSearchChange} placeholder="Rechercher…" />
<Table columns={columns} data={items} loading={loading} emptyText="Aucun résultat" />
{total > LIMIT && (
  <Pagination page={page} total={total} limit={LIMIT} onChange={p => setPage(p)} />
)}
```

- Import `Pagination` and `SearchInput` from `components/ui`
- `Pagination` shows "Affichage X–Y sur Z résultats" + page buttons automatically
- When a filter (wilaya, status, etc.) changes, always reset `page` to 1

## Rules
- ALWAYS filter by `tenant_id` — never return cross-tenant data (RLS is OFF, so this is critical)
- Use `db` from `lib/db.ts` only — import nothing else for DB access
- French UI labels everywhere in components
- UUID primary keys on all tables
- Soft deletes: always add `AND o.deleted_at IS NULL` on `orders` and `products`
- Schema is FINAL — never ALTER or CREATE tables from app code
- Never use any ORM (Prisma, Drizzle, TypeORM) — raw SQL only

## Order references — NEVER generate manually
```sql
SELECT generate_order_reference($1)  -- pass boutique_id
```

## RBAC — permission check pattern
```ts
function hasPermission(permissions: Record<string, boolean>, key: string): boolean {
  return permissions['*'] === true || permissions[key] === true
}
// Super Admin has {"*": true} — wildcard beats all
// Example keys: "orders.en_confirmation.confirm", "products.create"
```

---

## Database tables reference

### Auth & Tenants (002)
| Table | Key columns |
|-------|------------|
| `tenants` | id, name, slug, plan, is_active, trial_ends_at |
| `boutiques` | id, tenant_id, name, prefix, domain, order_seq, is_active |
| `roles` | id, tenant_id, name, permissions JSONB, is_system |
| `users` | id, tenant_id, name, email, password_hash, email_verified, two_fa_enabled, is_online, last_seen_at, is_active |
| `user_roles` | user_id, role_id |
| `user_boutiques` | user_id, boutique_id |
| `sessions` | id, user_id, token_hash, ip_address, expires_at |
| `audit_logs` | id, tenant_id, user_id, entity_type, entity_id, action, old_values, new_values |

### Clients & Catalog (003)
| Table | Key columns |
|-------|------------|
| `clients` | id, tenant_id, full_name, phone, phone2, email, wilaya_id, commune_id, address, orders_delivered, orders_returned, orders_cancelled |
| `brands` | id, tenant_id, name |
| `suppliers` | id, tenant_id, name, phone, email, address |
| `warehouses` | id, tenant_id, name, address, is_active |

### Products (004)
| Table | Key columns |
|-------|------------|
| `products` | id, tenant_id, brand_id, name, sku, barcode, price, compare_price, out_of_stock_behavior ('allow'\|'deny'), stock_alert_enabled, stock_alert_min, stock_strategy ('fifo'\|'lifo'\|'fefo'\|'random'), external_link, confirmer_notes, weight_g, length_cm, width_cm, height_cm, is_active, deleted_at |
| `product_boutiques` | product_id, boutique_id |
| `product_images` | id, product_id, url, sort_order |
| `product_variants` | id, product_id, sku, price (override), is_active |
| `option_types` | id, tenant_id, name, sort_order |
| `option_values` | id, option_type_id, value, sort_order |
| `variant_options` | variant_id, option_value_id |
| `product_delivery_fees` | id, product_id, wilaya_id (NULL=all), pricing_rule ('standard'\|'specific'), delivery_fee, stopdesk_fee |

### Stock (005)
| Table | Key columns |
|-------|------------|
| `stock_batches` | id, tenant_id, product_id, variant_id, warehouse_id, supplier_id, batch_number, quantity, unit_cost, expiry_date, is_active |
| `stock_movements` | id, tenant_id, product_id, variant_id, warehouse_id, batch_id, user_id, operation_type ('add'\|'remove'\|'correct'), target_type ('new_batch'\|'global'\|'existing_batch'), quantity, unit_cost, comment |

### Carriers & Statuses (006)
| Table | Key columns |
|-------|------------|
| `carriers` | id, tenant_id, name, phone, platform, wilaya_ids[], manages_stock, is_active |
| `carrier_boutiques` | carrier_id, boutique_id |
| `tracking_statuses` | id, tenant_id, name, slug, sms_notify, is_system, is_active, sort_order |
| `confirmation_statuses` | id, tenant_id, name, slug, sms_notify, is_active, sort_order |
| `delivery_statuses` | id, tenant_id, name, slug, sms_notify, is_active, sort_order |

### Orders (007)
| Table | Key columns |
|-------|------------|
| `orders` | id, boutique_id, client_id, assigned_confirmer_id, assigned_carrier_id, reference, tracking_status, confirmation_status, delivery_status, subtotal, delivery_fee, carrier_fee, discount, total (computed), delivery_method, wilaya_id, commune_id, address, phone, phone2, referrer, remark, source_type ('manual'\|'google_sheet'\|'shopify'\|'furulue'\|'api'), return_risk_score, sync_enabled, confirmed_at…cancelled_at, deleted_at |
| `order_items` | id, order_id, product_id, variant_id, product_name, sku, quantity, unit_price, unit_cost, line_total (computed) |
| `order_logs` | id, order_id, user_id, action, old_values, new_values, ip_address |
| `sav_items` | id, order_id, product_id, variant_id, quantity, unit_cost, reason |
| `receipts` | id, order_id, carrier_id, type ('encaissement'\|'retour'), status ('pending'\|'confirmed'), amount, confirmed_by, confirmed_at |
| `pickups` | id, order_id, carrier_id, status ('en_collecte'\|'collecte'\|'recu'\|'traite'\|'annule'), sync_enabled, collected_at, received_at, processed_at, cancelled_at |

### Imports & Webhooks (008)
| Table | Key columns |
|-------|------------|
| `import_sources` | id, boutique_id, type ('google_sheet'\|'shopify'\|'furulue'\|'api'), name, credentials_ref, sheet_id, sheet_name, separator, column_mapping JSONB, is_active, last_synced_at |
| `import_runs` | id, import_source_id, rows_total, rows_imported, rows_failed, status ('running'\|'completed'\|'failed'\|'partial'), errors JSONB |
| `webhooks` | id, tenant_id, name, event, url, secret, boutique_ids[], is_active |
| `webhook_logs` | id, webhook_id, order_id, event, http_status, request_payload, response_body, attempt, duration_ms |

### Accounting (009)
| Table | Key columns |
|-------|------------|
| `expense_types` | id, tenant_id, name, is_active |
| `expenses` | id, tenant_id, boutique_id, expense_type_id, user_id, amount, period_type ('one_time'\|'monthly'\|'date_range'), period_start, period_end, note |
| `advertising_costs` | id, tenant_id, boutique_id, user_id, amount, period_start, period_end, note |
| `confirmation_cost_configs` | boutique_id (unique), cost_amount, apply_to ('each_order'\|'all_orders'), based_on ('confirmed_orders'\|'delivered_orders') |
| `packaging_cost_configs` | boutique_id (unique), cost_amount, apply_per ('order'\|'product'), based_on ('shipped_orders'\|'delivered_orders') |
| `sms_templates` | id, tenant_id, event_type, body, is_active |
| `sms_logs` | id, tenant_id, order_id, client_id, phone, body, status ('pending'\|'sent'\|'delivered'\|'failed'), provider_ref |
| `notifications` | id, user_id, type, title, body, is_read, meta JSONB |

### Inventory (011)
| Table | Key columns |
|-------|------------|
| `inventory_sessions` | id, tenant_id, boutique_id, warehouse_id, created_by, confirmed_by, mode ('inventory'\|'mega_inventory'), status ('open'\|'confirmed'\|'cancelled'), confirmed_at |
| `inventory_session_items` | id, session_id, product_id, variant_id, expected_qty, counted_qty, difference (computed), unit_cost |

### Reference tables (001)
| Table | Notes |
|-------|-------|
| `wilayas` | id (1–58), name, code — shared, NOT tenant-scoped |
| `communes` | id, wilaya_id, name — shared, NOT tenant-scoped |

---

## DB views available (use in queries)
| View | Purpose |
|------|---------|
| `v_order_facts` | One row per order_item — all fields joined (boutique, client, carrier, confirmer, wilaya, commune, product, variant). Base for all stat reports. |
| `v_stat_by_boutique` | Orders grouped by boutique + all dimensions (wilaya, livreur, confirmateur, produit, variante) |
| `v_stat_by_wilaya` | Orders grouped by wilaya + tracking_status |
| `v_stat_by_commune` | Orders grouped by commune + tracking_status |
| `v_stat_by_product` | Orders grouped by product/variant + tracking_status |
| `v_stat_by_confirmer` | Orders grouped by confirmer + tracking_status |
| `v_stat_by_carrier` | Orders grouped by carrier + tracking_status |
| `v_bilan_facts` | One row per order — financials + items_cost + sav_cost for bilan général |
| `v_stock_summary` | Total qty per product/variant/warehouse |
| `v_stock_alerts` | Products below their stock_alert_min threshold |

---

## Status values (use these exact strings in queries)

### tracking_status (orders)
`en_confirmation` → `en_preparation` → `en_dispatch` → `en_livraison` → `livree`
→ `en_retour` → `retournee` | `encaissee` | `annulee`

### confirmation_status (sub-status, set by agent)
Default slugs: `echec_1`, `echec_2`, `echec_3`, `suspendue`, `annulation_demande`
(tenant can add more via CRUD)

### delivery_status (sub-status, set by carrier)
Default slugs: `ne_repond_pas`, `tel_eteint`, `reportee`, `annulee_client`, `autre`
(tenant can add more via CRUD)

### pickup status
`en_collecte` → `collecte` → `recu` → `traite` | `annule`

### receipt type / status
type: `encaissement` | `retour`
status: `pending` | `confirmed`

---

## Webhook events (19 total)
`OrderCreated` `OrderConfirmed` `OrderDispatched` `OrderShipped` `OrderDelivered`
`OrderFailed` `OrderPaid` `OrderReturned` `OrderCanceled` `OrderDeleted`
`OrderStatusChanged` `OrderConfirmationStatusChanged` `OrderShippingStatusChanged`
`OrderTrackingStatusChanged` `OrderAddressChanged` `OrderItemsChanged`
`OrderRestored` `OrderConfirmerChanged` `OrderCarrierChanged`

---

## Permission keys (roles.permissions JSONB)
```
orders.en_confirmation.view | confirm | cancel | delete | assign_confirmer
orders.en_confirmation.edit_discount | edit_price | edit_delivery_fee | bulk_action
orders.en_preparation.view | go_back | cancel | change_carrier | dispatch
orders.en_preparation.print_labels | export | edit | edit_discount | bulk_action
orders.en_dispatch.view | cancel | go_back | change_carrier | print_labels
orders.en_dispatch.print_route | ship | export | edit | disable_sync | bulk_action
orders.en_livraison.view | go_back | track | request_return | validate_delivery
orders.en_livraison.edit | edit_carrier_fee | disable_sync | bulk_action
orders.livrees.view | go_back | prepare_bon | edit | edit_carrier_fee | bulk_action
orders.en_retour.view | go_back | prepare_bon | validate_return | edit | bulk_action
orders.archive_encaissees.view | go_back | bulk_action
orders.archive_retournees.view | go_back | bulk_action
orders.archive_annulees.view | delete | restore | bulk_action
orders.corbeille.view | undo_delete | bulk_action
orders.bon_encaissement.view | go_back | confirm | bulk_action
orders.bon_retour.view | go_back | confirm | bulk_action
orders.pickups_en_collecte.view | go_back | cancel | delete | edit | validate_collect | disable_sync | bulk_action
orders.pickups_collecte.view | go_back | edit | prepare_bon | validate_reception | disable_sync | bulk_action
orders.pickups_recus.view | go_back | edit | validate_processing | bulk_action
orders.pickups_traites.view | go_back | bulk_action
orders.pickups_annules.view | go_back | delete | bulk_action
stats.boutique | stats.product | stats.delivery | stats.confirmation | stats.order
data.export | data.reports
products.view | create | edit | trash | move_to_trash | restore | delete
stock.adjust | stock.movements | stock.batches | stock.alerts | stock.inventory
stock.mega_inventory | stock.view_purchase_price
brands.create | edit | delete
suppliers.create | edit | delete
accounting.bilan | accounting.product_profitability | accounting.enter_expenses
webhooks.create | edit | delete | view_logs
config.sources | config.clients | config.delivery | config.boutiques
config.statuses | config.users | config.roles | config.subscription | config.advanced
other.view_unassigned_orders | other.view_order_logs
```

---

## Tailwind v4 notes
- No `tailwind.config.js` — theme is configured via `@theme` block in `globals.css`
- Add brand colors in `globals.css`:
  ```css
  @import "tailwindcss";
  @theme {
    --color-primary: #BF4C98;
    --color-bg-base: #FFF7F2;
    --color-border: #E2D8E2;
  }
  ```
- Use as: `bg-primary`, `text-primary`, `bg-bg-base`, `border-border`

## Next.js 15 / React 19 notes
- App Router only — no pages/ directory
- Server Components by default — add `'use client'` only when needed (hooks, events)
- API routes: `app/api/.../route.ts` with named exports (GET, POST, PUT, DELETE, PATCH)
- `params` in dynamic routes is now a Promise: `const { id } = await params`
- Use `searchParams` from `req.nextUrl.searchParams` in API routes

## Seed function (call after tenant creation)
```sql
SELECT seed_tenant_defaults($1);  -- pass tenant_id
-- Creates: 9 tracking statuses, 5 confirmation statuses, 5 delivery statuses,
--          default warehouse, Super Admin role with {"*": true}
```
