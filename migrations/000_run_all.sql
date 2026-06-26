-- ============================================================
-- 000_run_all.sql
-- Master migration runner — execute in order
-- Usage: psql -U postgres -d ecomanager -f 000_run_all.sql
-- ============================================================

\echo '>>> 001 Reference tables (wilayas, communes)'
\i 001_reference_tables.sql

\echo '>>> 002 Auth & tenants (tenants, boutiques, users, roles, sessions, audit)'
\i 002_auth_and_tenants.sql

\echo '>>> 003 Clients & catalog (clients, brands, suppliers, warehouses)'
\i 003_clients_and_catalog.sql

\echo '>>> 004 Products (products, variants, options, delivery fees)'
\i 004_products.sql

\echo '>>> 005 Stock (batches, movements, alert view)'
\i 005_stock.sql

\echo '>>> 006 Carriers & statuses (carriers, tracking/confirmation/delivery statuses)'
\i 006_carriers_and_statuses.sql

\echo '>>> 007 Orders (orders, items, logs, SAV, pickups, receipts)'
\i 007_orders.sql

\echo '>>> 008 Imports & webhooks (Google Sheet, webhook logs)'
\i 008_imports_and_webhooks.sql

\echo '>>> 009 Accounting (expenses, ad costs, SMS, notifications)'
\i 009_accounting.sql

\echo '>>> 010 Stats views (5 report views + bilan facts)'
\i 010_stats_views.sql

\echo ''
\echo '✓ All migrations completed.'
\echo ''
\echo 'Next step: call seed_tenant_defaults(tenant_id) after first tenant signup.'
