-- ============================================================
-- 009_accounting.sql
-- Expense types, expenses, advertising/confirmation/packaging costs
-- These feed directly into the bilan général and rentabilité produit
-- ============================================================

-- ── Expense types (type des charges) ─────────────────────────
CREATE TABLE expense_types (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(150) NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_expense_types_tenant ON expense_types(tenant_id);

-- ── Expenses (saisie des charges) ────────────────────────────
-- period_type: 'one_time' | 'monthly' | 'date_range'
CREATE TABLE expenses (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID          NOT NULL REFERENCES tenants(id)      ON DELETE CASCADE,
  boutique_id      UUID          REFERENCES boutiques(id)             ON DELETE SET NULL,
  expense_type_id  UUID          NOT NULL REFERENCES expense_types(id) ON DELETE RESTRICT,
  user_id          UUID          REFERENCES users(id)                 ON DELETE SET NULL,
  amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  period_type      VARCHAR(20)   NOT NULL DEFAULT 'one_time',
  period_start     DATE,
  period_end       DATE,
  note             TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_tenant   ON expenses(tenant_id);
CREATE INDEX idx_expenses_boutique ON expenses(boutique_id);
CREATE INDEX idx_expenses_type     ON expenses(expense_type_id);
CREATE INDEX idx_expenses_period   ON expenses(period_start, period_end);

-- ── Advertising costs (frais publicitaires) ──────────────────
-- Entered manually per boutique + period, used in bilan général
CREATE TABLE advertising_costs (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  boutique_id  UUID          REFERENCES boutiques(id)         ON DELETE SET NULL,
  user_id      UUID          REFERENCES users(id)             ON DELETE SET NULL,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  period_start DATE          NOT NULL,
  period_end   DATE          NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_adv_costs_tenant   ON advertising_costs(tenant_id);
CREATE INDEX idx_adv_costs_boutique ON advertising_costs(boutique_id);
CREATE INDEX idx_adv_costs_period   ON advertising_costs(period_start, period_end);

-- ── Confirmation cost config (frais de confirmation) ─────────
-- apply_to:  'each_order' | 'all_orders'
-- based_on:  'confirmed_orders' | 'delivered_orders'
CREATE TABLE confirmation_cost_configs (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  boutique_id  UUID          NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE UNIQUE,
  cost_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  apply_to     VARCHAR(20)   NOT NULL DEFAULT 'each_order',
  based_on     VARCHAR(30)   NOT NULL DEFAULT 'confirmed_orders',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Packaging cost config (frais d'emballage) ────────────────
-- apply_per: 'order' | 'product'
-- based_on:  'shipped_orders' | 'delivered_orders'
CREATE TABLE packaging_cost_configs (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  boutique_id  UUID          NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE UNIQUE,
  cost_amount  NUMERIC(10,2) NOT NULL DEFAULT 0,
  apply_per    VARCHAR(20)   NOT NULL DEFAULT 'order',
  based_on     VARCHAR(30)   NOT NULL DEFAULT 'shipped_orders',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── SMS templates and logs ────────────────────────────────────
-- event_type matches tracking/confirmation/delivery status slugs
CREATE TABLE sms_templates (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(80)  NOT NULL,
  body       TEXT         NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, event_type)
);

CREATE TABLE sms_logs (
  id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id     UUID         REFERENCES orders(id)           ON DELETE SET NULL,
  client_id    UUID         REFERENCES clients(id)          ON DELETE SET NULL,
  phone        VARCHAR(30)  NOT NULL,
  body         TEXT         NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
  -- 'pending' | 'sent' | 'delivered' | 'failed'
  provider_ref VARCHAR(255),
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sms_logs_tenant  ON sms_logs(tenant_id);
CREATE INDEX idx_sms_logs_order   ON sms_logs(order_id);
CREATE INDEX idx_sms_logs_created ON sms_logs(created_at DESC);

-- ── In-app notifications ─────────────────────────────────────
CREATE TABLE notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(80) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  meta       JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user    ON notifications(user_id);
CREATE INDEX idx_notifications_unread  ON notifications(user_id, is_read)
  WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
