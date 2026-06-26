-- ============================================================
-- 004_products.sql
-- Products, variants, option types/values, delivery fees
-- ============================================================

-- ── Option types (Couleur, Pointure, Taille…) ───────────────
CREATE TABLE option_types (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_option_types_tenant ON option_types(tenant_id);

-- ── Option values (Noir, Blanc, 38, XL…) ────────────────────
CREATE TABLE option_values (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_type_id UUID         NOT NULL REFERENCES option_types(id) ON DELETE CASCADE,
  value          VARCHAR(100) NOT NULL,
  sort_order     INTEGER      NOT NULL DEFAULT 0,
  UNIQUE(option_type_id, value)
);

CREATE INDEX idx_option_values_type ON option_values(option_type_id);

-- ── Products ─────────────────────────────────────────────────
CREATE TYPE stock_strategy_enum   AS ENUM ('fifo', 'lifo', 'fefo', 'random');
CREATE TYPE out_of_stock_behavior AS ENUM ('allow', 'deny');

CREATE TABLE products (
  id                     UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id              UUID                  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id               UUID                  REFERENCES brands(id) ON DELETE SET NULL,
  name                   VARCHAR(255)          NOT NULL,
  sku                    VARCHAR(100)          NOT NULL,
  barcode                VARCHAR(100),
  price                  NUMERIC(12,2)         NOT NULL DEFAULT 0,
  compare_price          NUMERIC(12,2),
  out_of_stock_behavior  out_of_stock_behavior NOT NULL DEFAULT 'allow',
  stock_alert_enabled    BOOLEAN               NOT NULL DEFAULT FALSE,
  stock_alert_min        INTEGER               NOT NULL DEFAULT 0,
  stock_strategy         stock_strategy_enum   NOT NULL DEFAULT 'fifo',
  -- Notes shown to confirmer agent when placing/confirming order
  external_link          TEXT,
  confirmer_notes        TEXT,
  -- Dimensions
  weight_g               INTEGER,
  length_cm              NUMERIC(8,2),
  width_cm               NUMERIC(8,2),
  height_cm              NUMERIC(8,2),
  is_active              BOOLEAN               NOT NULL DEFAULT TRUE,
  deleted_at             TIMESTAMPTZ,          -- soft delete (corbeille)
  created_at             TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, sku)
);

CREATE INDEX idx_products_tenant     ON products(tenant_id);
CREATE INDEX idx_products_sku        ON products(tenant_id, sku);
CREATE INDEX idx_products_active     ON products(tenant_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_deleted    ON products(tenant_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- ── Product ↔ Boutique (N:N) ─────────────────────────────────
CREATE TABLE product_boutiques (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  boutique_id UUID NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  UNIQUE(product_id, boutique_id)
);

CREATE INDEX idx_product_boutiques_product  ON product_boutiques(product_id);
CREATE INDEX idx_product_boutiques_boutique ON product_boutiques(boutique_id);

-- ── Product images ───────────────────────────────────────────
CREATE TABLE product_images (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID         NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT         NOT NULL,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON product_images(product_id);

-- ── Product variants (SKU combinations) ──────────────────────
CREATE TABLE product_variants (
  id         UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku        VARCHAR(100)  NOT NULL,
  price      NUMERIC(12,2),          -- overrides product price if set
  is_active  BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, sku)
);

CREATE INDEX idx_variants_product ON product_variants(product_id);

-- ── Variant ↔ Option values ──────────────────────────────────
CREATE TABLE variant_options (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id      UUID NOT NULL REFERENCES product_variants(id)  ON DELETE CASCADE,
  option_value_id UUID NOT NULL REFERENCES option_values(id)      ON DELETE CASCADE,
  UNIQUE(variant_id, option_value_id)
);

CREATE INDEX idx_variant_options_variant ON variant_options(variant_id);

-- ── Product delivery fees per wilaya ────────────────────────
-- pricing_rule: 'standard' | 'specific'
-- A row with wilaya_id = NULL means "all wilayas" default
CREATE TABLE product_delivery_fees (
  id             UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID          NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  wilaya_id      SMALLINT      REFERENCES wilayas(id),
  pricing_rule   VARCHAR(20)   NOT NULL DEFAULT 'standard',
  delivery_fee   NUMERIC(10,2) NOT NULL DEFAULT 0,
  stopdesk_fee   NUMERIC(10,2) NOT NULL DEFAULT 0,
  UNIQUE(product_id, wilaya_id)
);

CREATE INDEX idx_delivery_fees_product ON product_delivery_fees(product_id);
CREATE INDEX idx_delivery_fees_wilaya  ON product_delivery_fees(wilaya_id);
