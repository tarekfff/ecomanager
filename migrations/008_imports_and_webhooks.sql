-- ============================================================
-- 008_imports_and_webhooks.sql
-- Google Sheet import, webhooks, webhook logs
-- ============================================================

-- ── Import sources ───────────────────────────────────────────
-- type: 'google_sheet' | 'shopify' | 'furulue' | 'api'
CREATE TABLE import_sources (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  boutique_id     UUID        NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  type            VARCHAR(30) NOT NULL DEFAULT 'google_sheet',
  name            VARCHAR(150) NOT NULL,
  -- Encrypted OAuth token reference (actual token stored in secrets manager)
  credentials_ref VARCHAR(255),
  -- Google Sheet specific
  sheet_id        VARCHAR(255),
  sheet_name      VARCHAR(255),
  -- Separator between multiple products in one cell e.g. ","
  separator       VARCHAR(10)  DEFAULT ',',
  -- JSON map: { "order_number": "A", "client": "B", "phone": "C", ... }
  -- Keys are our field names, values are sheet column letters or header names
  column_mapping  JSONB        NOT NULL DEFAULT '{}',
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_sources_boutique ON import_sources(boutique_id);

-- ── Import runs ──────────────────────────────────────────────
-- status: 'running' | 'completed' | 'failed' | 'partial'
CREATE TABLE import_runs (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_source_id UUID        NOT NULL REFERENCES import_sources(id) ON DELETE CASCADE,
  rows_total       INTEGER     NOT NULL DEFAULT 0,
  rows_imported    INTEGER     NOT NULL DEFAULT 0,
  rows_failed      INTEGER     NOT NULL DEFAULT 0,
  status           VARCHAR(20) NOT NULL DEFAULT 'running',
  errors           JSONB       NOT NULL DEFAULT '[]',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ
);

CREATE INDEX idx_import_runs_source  ON import_runs(import_source_id);
CREATE INDEX idx_import_runs_started ON import_runs(started_at DESC);

-- ── Webhooks ─────────────────────────────────────────────────
-- event: one of the 19 event types
CREATE TABLE webhooks (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(150)  NOT NULL,
  event        VARCHAR(80)   NOT NULL,
  url          TEXT          NOT NULL,
  secret       VARCHAR(255),             -- HMAC signing secret
  boutique_ids UUID[]        NOT NULL DEFAULT '{}',  -- empty = all boutiques
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX idx_webhooks_event  ON webhooks(event);

-- Supported event values (enforced in app layer, documented here):
-- OrderCreated | OrderConfirmed | OrderDispatched | OrderShipped
-- OrderDelivered | OrderFailed | OrderPaid | OrderReturned
-- OrderCanceled | OrderDeleted | OrderStatusChanged
-- OrderConfirmationStatusChanged | OrderShippingStatusChanged
-- OrderTrackingStatusChanged | OrderAddressChanged | OrderItemsChanged
-- OrderRestored | OrderConfirmerChanged | OrderCarrierChanged

-- ── Webhook logs ─────────────────────────────────────────────
CREATE TABLE webhook_logs (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id       UUID        NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  order_id         UUID        REFERENCES orders(id)            ON DELETE SET NULL,
  event            VARCHAR(80) NOT NULL,
  http_status      SMALLINT,
  request_payload  JSONB,
  response_body    TEXT,
  attempt          SMALLINT    NOT NULL DEFAULT 1,
  duration_ms      INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_webhook ON webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_order   ON webhook_logs(order_id);
CREATE INDEX idx_webhook_logs_created ON webhook_logs(created_at DESC);
