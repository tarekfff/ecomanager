-- ============================================================
-- 007_orders.sql
-- Orders, order items, logs, SAV, pickups, receipts
-- ============================================================

-- ── Orders ───────────────────────────────────────────────────
CREATE TABLE orders (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  boutique_id           UUID          NOT NULL REFERENCES boutiques(id)  ON DELETE RESTRICT,
  client_id             UUID          REFERENCES clients(id)             ON DELETE SET NULL,
  assigned_confirmer_id UUID          REFERENCES users(id)               ON DELETE SET NULL,
  assigned_carrier_id   UUID          REFERENCES carriers(id)            ON DELETE SET NULL,

  -- Auto-generated: boutique.prefix + zero-padded seq e.g. "elmo0031"
  reference             VARCHAR(50)   NOT NULL UNIQUE,

  -- Status pipeline
  tracking_status       VARCHAR(80)   NOT NULL DEFAULT 'en_confirmation',
  confirmation_status   VARCHAR(80),
  delivery_status       VARCHAR(80),

  -- Financials
  subtotal              NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee          NUMERIC(12,2) NOT NULL DEFAULT 0,
  carrier_fee           NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount              NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                 NUMERIC(12,2) GENERATED ALWAYS AS
                          (subtotal + delivery_fee - discount) STORED,

  -- Delivery info (snapshot at order time)
  delivery_method       VARCHAR(80),
  wilaya_id             SMALLINT      REFERENCES wilayas(id),
  commune_id            INTEGER       REFERENCES communes(id),
  address               TEXT,
  phone                 VARCHAR(30),
  phone2                VARCHAR(30),

  -- Metadata
  referrer              VARCHAR(255),  -- 'facebook', 'instagram', etc.
  remark                TEXT,
  source_type           VARCHAR(30)   NOT NULL DEFAULT 'manual',
  -- 'manual' | 'google_sheet' | 'shopify' | 'furulue' | 'api'
  source_ref            VARCHAR(255),  -- external order id / sheet row ref
  ip_address            INET,

  -- Return risk score (computed by app or ML)
  return_risk_score     SMALLINT      CHECK (return_risk_score BETWEEN 0 AND 100),

  -- Sync flag per-order (can be disabled from dispatch/livraison)
  sync_enabled          BOOLEAN       NOT NULL DEFAULT TRUE,

  -- Status timestamps — all indexed, used in stats filters
  confirmed_at          TIMESTAMPTZ,
  assigned_at           TIMESTAMPTZ,
  dispatched_at         TIMESTAMPTZ,
  shipped_at            TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  returned_at           TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,

  deleted_at            TIMESTAMPTZ,  -- soft delete (corbeille)
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Core query indexes (list views + stats)
CREATE INDEX idx_orders_boutique         ON orders(boutique_id);
CREATE INDEX idx_orders_tracking         ON orders(boutique_id, tracking_status);
CREATE INDEX idx_orders_client           ON orders(client_id);
CREATE INDEX idx_orders_confirmer        ON orders(assigned_confirmer_id);
CREATE INDEX idx_orders_carrier          ON orders(assigned_carrier_id);
CREATE INDEX idx_orders_wilaya           ON orders(wilaya_id);
CREATE INDEX idx_orders_created          ON orders(boutique_id, created_at DESC);
CREATE INDEX idx_orders_delivered        ON orders(boutique_id, delivered_at DESC)
  WHERE delivered_at IS NOT NULL;
CREATE INDEX idx_orders_deleted          ON orders(boutique_id, deleted_at)
  WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_orders_reference        ON orders(reference);
-- Composite for stats module (most common filter pattern)
CREATE INDEX idx_orders_stats            ON orders(boutique_id, tracking_status, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── Reference auto-generation ────────────────────────────────
-- Atomically increments boutique sequence and returns padded reference
CREATE OR REPLACE FUNCTION generate_order_reference(p_boutique_id UUID)
RETURNS VARCHAR LANGUAGE plpgsql AS $$
DECLARE
  v_prefix  VARCHAR;
  v_seq     INTEGER;
  v_ref     VARCHAR;
BEGIN
  UPDATE boutiques
  SET    order_seq = order_seq + 1
  WHERE  id = p_boutique_id
  RETURNING prefix, order_seq INTO v_prefix, v_seq;

  v_ref := v_prefix || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_ref;
END;
$$;

-- ── Order items ──────────────────────────────────────────────
CREATE TABLE order_items (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID          REFERENCES products(id)        ON DELETE SET NULL,
  variant_id    UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
  -- Snapshots at order time (product may change later)
  product_name  VARCHAR(255)  NOT NULL,
  sku           VARCHAR(100)  NOT NULL,
  quantity      INTEGER       NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost     NUMERIC(12,2) NOT NULL DEFAULT 0,  -- from stock batch at dispatch
  line_total    NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ── Order logs (journal) ─────────────────────────────────────
CREATE TABLE order_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(80) NOT NULL,
  -- e.g. 'status_changed', 'carrier_changed', 'price_edited', 'note_added'
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_logs_order   ON order_logs(order_id);
CREATE INDEX idx_order_logs_user    ON order_logs(user_id);
CREATE INDEX idx_order_logs_created ON order_logs(created_at DESC);

-- ── SAV items (service after-sale / damaged products) ────────
CREATE TABLE sav_items (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID          REFERENCES products(id)        ON DELETE SET NULL,
  variant_id  UUID          REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity    INTEGER       NOT NULL DEFAULT 1,
  unit_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason      TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sav_order   ON sav_items(order_id);
CREATE INDEX idx_sav_product ON sav_items(product_id);

-- ── Receipts (bons d'encaissement / bons de retour) ──────────
-- type: 'encaissement' | 'retour'
-- status: 'pending' | 'confirmed'
CREATE TABLE receipts (
  id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID          NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  carrier_id    UUID          REFERENCES carriers(id)          ON DELETE SET NULL,
  type          VARCHAR(20)   NOT NULL,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending',
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  confirmed_by  UUID          REFERENCES users(id)             ON DELETE SET NULL,
  confirmed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipts_order   ON receipts(order_id);
CREATE INDEX idx_receipts_carrier ON receipts(carrier_id);
CREATE INDEX idx_receipts_status  ON receipts(status);

-- ── Pickups ──────────────────────────────────────────────────
-- status: 'en_collecte' | 'collecte' | 'recu' | 'traite' | 'annule'
CREATE TABLE pickups (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID        NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  carrier_id    UUID        REFERENCES carriers(id)          ON DELETE SET NULL,
  status        VARCHAR(30) NOT NULL DEFAULT 'en_collecte',
  sync_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
  collected_at  TIMESTAMPTZ,
  received_at   TIMESTAMPTZ,
  processed_at  TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pickups_order   ON pickups(order_id);
CREATE INDEX idx_pickups_carrier ON pickups(carrier_id);
CREATE INDEX idx_pickups_status  ON pickups(status);

-- ── updated_at trigger (reusable) ────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pickups_updated_at
  BEFORE UPDATE ON pickups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
