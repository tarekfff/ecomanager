-- ============================================================
-- 005_stock.sql
-- Stock batches and movements — supports FIFO/LIFO/FEFO/random
-- ============================================================

-- ── Stock batches (lots) ─────────────────────────────────────
-- Each batch = a physical lot of product received at a point in time
CREATE TABLE stock_batches (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id)       ON DELETE CASCADE,
  product_id   UUID          NOT NULL REFERENCES products(id)      ON DELETE CASCADE,
  variant_id   UUID          REFERENCES product_variants(id)       ON DELETE CASCADE,
  warehouse_id UUID          NOT NULL REFERENCES warehouses(id)    ON DELETE CASCADE,
  batch_number VARCHAR(100),
  quantity     INTEGER       NOT NULL DEFAULT 0,  -- current quantity in this batch
  unit_cost    NUMERIC(12,2) NOT NULL DEFAULT 0,
  expiry_date  DATE,                              -- required for FEFO strategy
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_tenant    ON stock_batches(tenant_id);
CREATE INDEX idx_batches_product   ON stock_batches(product_id);
CREATE INDEX idx_batches_variant   ON stock_batches(variant_id);
CREATE INDEX idx_batches_warehouse ON stock_batches(warehouse_id);
CREATE INDEX idx_batches_expiry    ON stock_batches(expiry_date) WHERE expiry_date IS NOT NULL;

-- ── Stock movements ──────────────────────────────────────────
-- Immutable log of every stock operation
-- operation_type: 'add' | 'remove' | 'correct'
-- target_type:    'new_batch' | 'global' | 'existing_batch'
CREATE TABLE stock_movements (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID          NOT NULL REFERENCES tenants(id)       ON DELETE CASCADE,
  product_id     UUID          NOT NULL REFERENCES products(id)      ON DELETE CASCADE,
  variant_id     UUID          REFERENCES product_variants(id),
  warehouse_id   UUID          NOT NULL REFERENCES warehouses(id),
  batch_id       UUID          REFERENCES stock_batches(id),
  user_id        UUID          REFERENCES users(id) ON DELETE SET NULL,
  operation_type VARCHAR(20)   NOT NULL, -- 'add' | 'remove' | 'correct'
  target_type    VARCHAR(20)   NOT NULL, -- 'new_batch' | 'global' | 'existing_batch'
  quantity       INTEGER       NOT NULL, -- positive = add, negative = remove
  unit_cost      NUMERIC(12,2),
  batch_number   VARCHAR(100),           -- snapshot at time of movement
  expiry_date    DATE,                   -- snapshot at time of movement
  comment        TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movements_tenant    ON stock_movements(tenant_id);
CREATE INDEX idx_movements_product   ON stock_movements(product_id);
CREATE INDEX idx_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX idx_movements_batch     ON stock_movements(batch_id);
CREATE INDEX idx_movements_user      ON stock_movements(user_id);
CREATE INDEX idx_movements_created   ON stock_movements(created_at DESC);

-- ── Helper view: current stock per product/variant/warehouse ─
CREATE VIEW v_stock_summary AS
SELECT
  p.tenant_id,
  sb.product_id,
  sb.variant_id,
  sb.warehouse_id,
  SUM(sb.quantity)                                            AS total_qty,
  COUNT(sb.id)                                               AS batch_count,
  MIN(sb.expiry_date) FILTER (WHERE sb.expiry_date IS NOT NULL) AS earliest_expiry,
  SUM(sb.quantity * sb.unit_cost)                            AS total_stock_value
FROM stock_batches sb
JOIN products p ON p.id = sb.product_id
WHERE sb.is_active = TRUE AND sb.quantity > 0
GROUP BY p.tenant_id, sb.product_id, sb.variant_id, sb.warehouse_id;

-- ── Helper view: stock alerts ────────────────────────────────
CREATE VIEW v_stock_alerts AS
SELECT
  p.tenant_id,
  p.id          AS product_id,
  p.name        AS product_name,
  p.sku,
  p.stock_alert_min,
  COALESCE(SUM(sb.quantity), 0) AS current_qty
FROM products p
LEFT JOIN stock_batches sb
       ON sb.product_id = p.id AND sb.is_active = TRUE
WHERE p.stock_alert_enabled = TRUE
  AND p.deleted_at IS NULL
GROUP BY p.tenant_id, p.id, p.name, p.sku, p.stock_alert_min
HAVING COALESCE(SUM(sb.quantity), 0) <= p.stock_alert_min;
