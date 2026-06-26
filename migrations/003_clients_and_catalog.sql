-- ============================================================
-- 003_clients_and_catalog.sql
-- Clients, brands, suppliers, warehouses
-- ============================================================

-- ── Clients ─────────────────────────────────────────────────
CREATE TABLE clients (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name           VARCHAR(200) NOT NULL,
  phone               VARCHAR(30)  NOT NULL,
  phone2              VARCHAR(30),
  email               VARCHAR(255),
  wilaya_id           SMALLINT     REFERENCES wilayas(id),
  commune_id          INTEGER      REFERENCES communes(id),
  address             TEXT,
  orders_delivered    INTEGER      NOT NULL DEFAULT 0,
  orders_returned     INTEGER      NOT NULL DEFAULT 0,
  orders_cancelled    INTEGER      NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_tenant    ON clients(tenant_id);
CREATE INDEX idx_clients_phone     ON clients(tenant_id, phone);
CREATE INDEX idx_clients_wilaya    ON clients(wilaya_id);

-- ── Brands ──────────────────────────────────────────────────
CREATE TABLE brands (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(150) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_brands_tenant ON brands(tenant_id);

-- ── Suppliers ───────────────────────────────────────────────
CREATE TABLE suppliers (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(150) NOT NULL,
  phone      VARCHAR(30),
  email      VARCHAR(255),
  address    TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id);

-- ── Warehouses ──────────────────────────────────────────────
CREATE TABLE warehouses (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(150) NOT NULL,
  address    TEXT,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_warehouses_tenant ON warehouses(tenant_id);
