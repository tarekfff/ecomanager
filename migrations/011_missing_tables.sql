-- ============================================================
-- 011_missing_tables.sql
-- Fills the 4 gaps identified vs the PDF plan:
--   1. Inventory session tables (Inventaire & Mega inventaire)
--   2. v_stat_by_boutique view (Rapport 1)
--   3. supplier_id on stock_batches
--   4. Trigger to keep client order counters in sync
-- ============================================================

-- ── 1. Inventory sessions ────────────────────────────────────
-- mode: 'inventory' (one warehouse) | 'mega_inventory' (all warehouses)
-- status: 'open' | 'confirmed' | 'cancelled'
CREATE TABLE inventory_sessions (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id)     ON DELETE CASCADE,
  boutique_id  UUID         REFERENCES boutiques(id)            ON DELETE SET NULL,
  warehouse_id UUID         REFERENCES warehouses(id)           ON DELETE SET NULL,
  created_by   UUID         REFERENCES users(id)                ON DELETE SET NULL,
  confirmed_by UUID         REFERENCES users(id)                ON DELETE SET NULL,
  mode         VARCHAR(20)  NOT NULL DEFAULT 'inventory',
  status       VARCHAR(20)  NOT NULL DEFAULT 'open',
  note         TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_sessions_tenant    ON inventory_sessions(tenant_id);
CREATE INDEX idx_inv_sessions_warehouse ON inventory_sessions(warehouse_id);
CREATE INDEX idx_inv_sessions_status    ON inventory_sessions(status);

CREATE TABLE inventory_session_items (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id          UUID          NOT NULL REFERENCES inventory_sessions(id) ON DELETE CASCADE,
  product_id          UUID          NOT NULL REFERENCES products(id)           ON DELETE CASCADE,
  variant_id          UUID          REFERENCES product_variants(id)            ON DELETE CASCADE,
  expected_qty        INTEGER       NOT NULL DEFAULT 0,  -- from stock_batches at session open
  counted_qty         INTEGER,                           -- physically counted, NULL = not yet counted
  difference          INTEGER GENERATED ALWAYS AS
                        (COALESCE(counted_qty, expected_qty) - expected_qty) STORED,
  unit_cost           NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inv_items_session ON inventory_session_items(session_id);
CREATE INDEX idx_inv_items_product ON inventory_session_items(product_id);

CREATE TRIGGER trg_inv_sessions_updated_at
  BEFORE UPDATE ON inventory_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 2. Stat view: by boutique (Rapport 1) ───────────────────
CREATE VIEW v_stat_by_boutique AS
SELECT
  f.tenant_id,
  f.boutique_id,
  f.boutique_name,
  f.tracking_status,
  f.wilaya_id,
  f.wilaya_name,
  f.commune_id,
  f.commune_name,
  f.carrier_id,
  f.carrier_name,
  f.confirmer_id,
  f.confirmer_name,
  f.product_id,
  f.product_name,
  f.variant_id,
  f.variant_sku,
  COUNT(DISTINCT f.order_id) AS order_count,
  SUM(f.quantity)            AS qty_sold,
  SUM(f.line_total)          AS revenue,
  SUM(f.carrier_fee)         AS carrier_fees_total
FROM v_order_facts f
GROUP BY
  f.tenant_id, f.boutique_id, f.boutique_name,
  f.tracking_status,
  f.wilaya_id, f.wilaya_name,
  f.commune_id, f.commune_name,
  f.carrier_id, f.carrier_name,
  f.confirmer_id, f.confirmer_name,
  f.product_id, f.product_name,
  f.variant_id, f.variant_sku;


-- ── 3. supplier_id on stock_batches ─────────────────────────
ALTER TABLE stock_batches
  ADD COLUMN supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX idx_batches_supplier ON stock_batches(supplier_id);


-- ── 4. Trigger: keep client order counters in sync ───────────
-- Fires on orders UPDATE when tracking_status changes to a terminal state
CREATE OR REPLACE FUNCTION sync_client_order_counters()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only act when tracking_status actually changed
  IF OLD.tracking_status = NEW.tracking_status THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Increment the right counter when reaching a terminal status
  IF NEW.tracking_status = 'livree' AND OLD.tracking_status <> 'livree' THEN
    UPDATE clients SET orders_delivered = orders_delivered + 1
    WHERE id = NEW.client_id;

  ELSIF NEW.tracking_status = 'retournee' AND OLD.tracking_status <> 'retournee' THEN
    UPDATE clients SET orders_returned = orders_returned + 1
    WHERE id = NEW.client_id;

  ELSIF NEW.tracking_status = 'annulee' AND OLD.tracking_status <> 'annulee' THEN
    UPDATE clients SET orders_cancelled = orders_cancelled + 1
    WHERE id = NEW.client_id;
  END IF;

  -- Decrement if rolling back FROM a terminal status (go_back action)
  IF OLD.tracking_status = 'livree' AND NEW.tracking_status <> 'livree' THEN
    UPDATE clients SET orders_delivered = GREATEST(orders_delivered - 1, 0)
    WHERE id = NEW.client_id;

  ELSIF OLD.tracking_status = 'retournee' AND NEW.tracking_status <> 'retournee' THEN
    UPDATE clients SET orders_returned = GREATEST(orders_returned - 1, 0)
    WHERE id = NEW.client_id;

  ELSIF OLD.tracking_status = 'annulee' AND NEW.tracking_status <> 'annulee' THEN
    UPDATE clients SET orders_cancelled = GREATEST(orders_cancelled - 1, 0)
    WHERE id = NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_client_counters
  AFTER UPDATE OF tracking_status ON orders
  FOR EACH ROW EXECUTE FUNCTION sync_client_order_counters();
