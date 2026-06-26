# ECOMANAGER — Database Migrations

## Stack
- **Database**: PostgreSQL 15+
- **Extensions**: uuid-ossp, pgcrypto (auto-installed in migration 002)

## File order

| File | Contents |
|------|----------|
| `001_reference_tables.sql` | Wilayas (58) + communes — shared, not tenant-scoped |
| `002_auth_and_tenants.sql` | Tenants, boutiques, users, roles, RBAC, sessions, audit_logs |
| `003_clients_and_catalog.sql` | Clients, brands, suppliers, warehouses |
| `004_products.sql` | Products, variants, option types/values, delivery fees per wilaya |
| `005_stock.sql` | Stock batches (lots), movements, alert view, stock summary view |
| `006_carriers_and_statuses.sql` | Carriers, tracking/confirmation/delivery statuses + seed function |
| `007_orders.sql` | Orders, order_items, order_logs, SAV, receipts, pickups |
| `008_imports_and_webhooks.sql` | Google Sheet import sources, import runs, webhooks, webhook_logs |
| `009_accounting.sql` | Expense types, expenses, ad costs, confirmation/packaging configs, SMS |
| `010_stats_views.sql` | 5 stat report views + bilan facts view |

## Run all at once

```bash
createdb ecomanager
psql -U postgres -d ecomanager -f 000_run_all.sql
```

## Run individually

```bash
psql -U postgres -d ecomanager -f 001_reference_tables.sql
psql -U postgres -d ecomanager -f 002_auth_and_tenants.sql
# ... etc in order
```

## After first tenant signup

Call the seed function to create default statuses, warehouse, and Super Admin role:

```sql
SELECT seed_tenant_defaults('your-tenant-uuid-here');
```

## Key design decisions

### Multi-tenancy
Every table (except `wilayas` and `communes`) has a `tenant_id` FK.
All queries MUST include `tenant_id` in the WHERE clause — enforce this in your ORM/query builder.

### Boutique prefix + reference generation
Order references are generated atomically:
```sql
SELECT generate_order_reference('boutique-uuid');
-- returns e.g. "elmo0031"
```
The `boutiques.order_seq` column is locked with `UPDATE ... RETURNING` — race-condition safe.

### RBAC permissions
Stored as a flat JSONB object on the `roles` table:
```json
{
  "orders.en_confirmation.confirm": true,
  "orders.en_confirmation.cancel": true,
  "stats.boutique": true
}
```
Super Admin role uses `{"*": true}` — wildcard checked first in app layer.

### Stock strategies
- **FIFO**: pick batch with oldest `created_at`
- **LIFO**: pick batch with newest `created_at`  
- **FEFO**: pick batch with earliest `expiry_date` (use `v_stock_alerts` view to monitor)
- **Random**: pick any batch with stock > 0

Strategy is stored per-product (`products.stock_strategy`), applied at dispatch time in app layer.

### Stats reports
All 5 stat reports query `v_order_facts` (denormalized view).
Date filtering is dynamic — the app layer selects the right timestamp column based on "Filtrer selon" parameter:

| UI option | Column |
|-----------|--------|
| Date de création | `created_at` |
| Date de confirmation | `confirmed_at` |
| Date d'expédition | `shipped_at` |
| Date de livraison | `delivered_at` |
| Date d'encaissement | `paid_at` |
| Date du retour | `returned_at` |
| Date d'annulation | `cancelled_at` |

### Soft deletes
- `products.deleted_at` — corbeille
- `orders.deleted_at` — corbeille  
All active-record queries add `WHERE deleted_at IS NULL`.

### Google Sheet import column_mapping
Stored as JSONB: keys = our field names, values = sheet column headers:
```json
{
  "client":           "Client",
  "phone":            "Téléphone",
  "wilaya":           "Wilaya",
  "product_sku":      "Produit (SKU)",
  "quantity":         "Quantité",
  "unit_price":       "Prix unitaire"
}
```
