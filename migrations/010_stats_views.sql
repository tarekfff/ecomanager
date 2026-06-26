-- ============================================================
-- 010_stats_views.sql
-- Materialized and live views powering all 5 stat reports
-- All views are designed around the common filter pattern:
--   boutique_id, date_field, date_range, based_on
-- ============================================================

-- ── Base order facts view ─────────────────────────────────────
-- Flat, denormalized — one row per order_item (for quantity stats)
-- Used by all stat reports as the foundation
CREATE VIEW v_order_facts AS
SELECT
  o.id                      AS order_id,
  o.boutique_id,
  b.tenant_id,
  b.name                    AS boutique_name,
  o.reference,
  o.tracking_status,
  o.confirmation_status,
  o.delivery_status,
  o.assigned_confirmer_id   AS confirmer_id,
  u_conf.name               AS confirmer_name,
  o.assigned_carrier_id     AS carrier_id,
  c_car.name                AS carrier_name,
  o.wilaya_id,
  w.name                    AS wilaya_name,
  o.commune_id,
  com.name                  AS commune_name,
  oi.product_id,
  p.name                    AS product_name,
  oi.variant_id,
  pv.sku                    AS variant_sku,
  oi.quantity,
  oi.unit_price,
  oi.unit_cost,
  oi.line_total,
  o.delivery_fee,
  o.carrier_fee,
  o.discount,
  o.total,
  -- All timestamp fields for flexible "filter by" support
  o.created_at,
  o.assigned_at,
  o.confirmed_at,
  o.dispatched_at,
  o.shipped_at,
  o.delivered_at,
  o.failed_at,
  o.paid_at,
  o.returned_at,
  o.cancelled_at
FROM orders o
JOIN boutiques b        ON b.id = o.boutique_id
JOIN order_items oi     ON oi.order_id = o.id
LEFT JOIN users u_conf  ON u_conf.id = o.assigned_confirmer_id
LEFT JOIN carriers c_car ON c_car.id = o.assigned_carrier_id
LEFT JOIN wilayas w     ON w.id = o.wilaya_id
LEFT JOIN communes com  ON com.id = o.commune_id
LEFT JOIN products p    ON p.id = oi.product_id
LEFT JOIN product_variants pv ON pv.id = oi.variant_id
WHERE o.deleted_at IS NULL;

-- ── Bilan général base view ───────────────────────────────────
-- One row per order — financials for accounting reports
CREATE VIEW v_bilan_facts AS
SELECT
  o.id                    AS order_id,
  o.boutique_id,
  b.tenant_id,
  o.tracking_status,
  o.subtotal,
  o.delivery_fee,
  o.carrier_fee,
  o.discount,
  o.total,
  -- Purchase cost of items in this order (sum of unit_cost * qty)
  COALESCE(SUM(oi.unit_cost * oi.quantity), 0)  AS items_cost,
  -- SAV cost for this order
  COALESCE(SUM(sav.unit_cost * sav.quantity), 0) AS sav_cost,
  o.created_at,
  o.delivered_at,
  o.shipped_at,
  o.confirmed_at
FROM orders o
JOIN boutiques b     ON b.id = o.boutique_id
JOIN order_items oi  ON oi.order_id = o.id
LEFT JOIN sav_items sav ON sav.order_id = o.id
WHERE o.deleted_at IS NULL
GROUP BY o.id, o.boutique_id, b.tenant_id, o.tracking_status,
         o.subtotal, o.delivery_fee, o.carrier_fee, o.discount, o.total,
         o.created_at, o.delivered_at, o.shipped_at, o.confirmed_at;

-- ── Helper: normalize date filter field ──────────────────────
-- Used in app layer to dynamically pick the right timestamp column
-- Mapping (applied in query builder, documented here):
--   'created'      → o.created_at
--   'assigned'     → o.assigned_at
--   'confirmed'    → o.confirmed_at
--   'dispatched'   → o.dispatched_at
--   'shipped'      → o.shipped_at
--   'delivered'    → o.delivered_at
--   'failed'       → o.failed_at
--   'paid'         → o.paid_at
--   'returned'     → o.returned_at
--   'cancelled'    → o.cancelled_at

-- ── Stat report: by wilaya ────────────────────────────────────
CREATE VIEW v_stat_by_wilaya AS
SELECT
  f.tenant_id,
  f.boutique_id,
  f.boutique_name,
  f.wilaya_id,
  f.wilaya_name,
  f.tracking_status,
  COUNT(DISTINCT f.order_id) AS order_count,
  SUM(f.quantity)            AS qty_sold,
  SUM(f.line_total)          AS revenue
FROM v_order_facts f
GROUP BY f.tenant_id, f.boutique_id, f.boutique_name,
         f.wilaya_id, f.wilaya_name, f.tracking_status;

-- ── Stat report: by commune ───────────────────────────────────
CREATE VIEW v_stat_by_commune AS
SELECT
  f.tenant_id,
  f.boutique_id,
  f.wilaya_id,
  f.wilaya_name,
  f.commune_id,
  f.commune_name,
  f.tracking_status,
  COUNT(DISTINCT f.order_id) AS order_count,
  SUM(f.quantity)            AS qty_sold,
  SUM(f.line_total)          AS revenue
FROM v_order_facts f
GROUP BY f.tenant_id, f.boutique_id,
         f.wilaya_id, f.wilaya_name, f.commune_id, f.commune_name,
         f.tracking_status;

-- ── Stat report: by product ───────────────────────────────────
CREATE VIEW v_stat_by_product AS
SELECT
  f.tenant_id,
  f.boutique_id,
  f.boutique_name,
  f.product_id,
  f.product_name,
  f.variant_id,
  f.variant_sku,
  f.tracking_status,
  COUNT(DISTINCT f.order_id) AS order_count,
  SUM(f.quantity)            AS qty_sold,
  SUM(f.line_total)          AS revenue,
  AVG(f.unit_cost)           AS avg_unit_cost
FROM v_order_facts f
GROUP BY f.tenant_id, f.boutique_id, f.boutique_name,
         f.product_id, f.product_name, f.variant_id, f.variant_sku,
         f.tracking_status;

-- ── Stat report: by confirmer ─────────────────────────────────
CREATE VIEW v_stat_by_confirmer AS
SELECT
  f.tenant_id,
  f.boutique_id,
  f.boutique_name,
  f.confirmer_id,
  f.confirmer_name,
  f.tracking_status,
  COUNT(DISTINCT f.order_id) AS order_count,
  SUM(f.quantity)            AS qty_sold,
  SUM(f.line_total)          AS revenue
FROM v_order_facts f
GROUP BY f.tenant_id, f.boutique_id, f.boutique_name,
         f.confirmer_id, f.confirmer_name, f.tracking_status;

-- ── Stat report: by carrier ───────────────────────────────────
CREATE VIEW v_stat_by_carrier AS
SELECT
  f.tenant_id,
  f.boutique_id,
  f.boutique_name,
  f.carrier_id,
  f.carrier_name,
  f.tracking_status,
  COUNT(DISTINCT f.order_id) AS order_count,
  SUM(f.quantity)            AS qty_sold,
  SUM(f.line_total)          AS revenue,
  SUM(f.carrier_fee)         AS carrier_fees_total
FROM v_order_facts f
GROUP BY f.tenant_id, f.boutique_id, f.boutique_name,
         f.carrier_id, f.carrier_name, f.tracking_status;
