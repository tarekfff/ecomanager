-- ============================================================
-- 006_carriers_and_statuses.sql
-- Carriers (livreurs), order status tables (configurable)
-- ============================================================

-- ── Carriers (livreurs) ──────────────────────────────────────
CREATE TABLE carriers (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           VARCHAR(150) NOT NULL,
  phone          VARCHAR(30),
  platform       VARCHAR(80),          -- external platform name e.g. "Yalidine", "ZR Express"
  wilaya_ids     SMALLINT[]   NOT NULL DEFAULT '{}',  -- covered wilayas
  manages_stock  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_carriers_tenant ON carriers(tenant_id);

-- ── Carrier ↔ Boutique (N:N) ─────────────────────────────────
CREATE TABLE carrier_boutiques (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  carrier_id  UUID NOT NULL REFERENCES carriers(id)   ON DELETE CASCADE,
  boutique_id UUID NOT NULL REFERENCES boutiques(id)  ON DELETE CASCADE,
  UNIQUE(carrier_id, boutique_id)
);

CREATE INDEX idx_carrier_boutiques_carrier  ON carrier_boutiques(carrier_id);
CREATE INDEX idx_carrier_boutiques_boutique ON carrier_boutiques(boutique_id);

-- ── Tracking statuses (general pipeline) ────────────────────
-- is_system = TRUE → not deletable, not renameable (core pipeline steps)
CREATE TABLE tracking_statuses (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(80)  NOT NULL,   -- machine key: 'en_confirmation', 'livree', ...
  sms_notify  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_system   BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_tracking_statuses_tenant ON tracking_statuses(tenant_id);

-- ── Confirmation statuses (sub-status during phone confirmation) ─
CREATE TABLE confirmation_statuses (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(80)  NOT NULL,
  sms_notify BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_confirmation_statuses_tenant ON confirmation_statuses(tenant_id);

-- ── Delivery statuses (sub-status during last-mile delivery) ─
CREATE TABLE delivery_statuses (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID         NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  slug       VARCHAR(80)  NOT NULL,
  sms_notify BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_delivery_statuses_tenant ON delivery_statuses(tenant_id);

-- ── Seed function: called after tenant signup ────────────────
-- Creates default statuses for a new tenant
CREATE OR REPLACE FUNCTION seed_tenant_defaults(p_tenant_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  -- Default tracking statuses (system = immutable)
  INSERT INTO tracking_statuses (tenant_id, name, slug, is_system, sort_order) VALUES
    (p_tenant_id, 'En confirmation', 'en_confirmation', TRUE,  1),
    (p_tenant_id, 'En préparation',  'en_preparation',  TRUE,  2),
    (p_tenant_id, 'En dispatch',     'en_dispatch',     TRUE,  3),
    (p_tenant_id, 'En livraison',    'en_livraison',    TRUE,  4),
    (p_tenant_id, 'Livrée',          'livree',          TRUE,  5),
    (p_tenant_id, 'En retour',       'en_retour',       TRUE,  6),
    (p_tenant_id, 'Encaissée',       'encaissee',       TRUE,  7),
    (p_tenant_id, 'Retournée',       'retournee',       TRUE,  8),
    (p_tenant_id, 'Annulée',         'annulee',         TRUE,  9);

  -- Default confirmation statuses (user-editable)
  INSERT INTO confirmation_statuses (tenant_id, name, slug, sort_order) VALUES
    (p_tenant_id, 'Confirmation échouée 1', 'echec_1',            1),
    (p_tenant_id, 'Confirmation échouée 2', 'echec_2',            2),
    (p_tenant_id, 'Confirmation échouée 3', 'echec_3',            3),
    (p_tenant_id, 'Suspendue',              'suspendue',          4),
    (p_tenant_id, 'Annulation demandée',    'annulation_demande', 5);

  -- Default delivery statuses (user-editable)
  INSERT INTO delivery_statuses (tenant_id, name, slug, sort_order) VALUES
    (p_tenant_id, 'Ne répond pas',      'ne_repond_pas',   1),
    (p_tenant_id, 'Téléphone éteint',   'tel_eteint',      2),
    (p_tenant_id, 'Reportée',           'reportee',        3),
    (p_tenant_id, 'Annulée par client', 'annulee_client',  4),
    (p_tenant_id, 'Autre raison',       'autre',           5);

  -- Default warehouse
  INSERT INTO warehouses (tenant_id, name) VALUES
    (p_tenant_id, 'Entrepôt principal');

  -- Super Admin role with all permissions
  INSERT INTO roles (tenant_id, name, is_system, permissions) VALUES
    (p_tenant_id, 'Super Admin', TRUE, '{"*": true}'::jsonb);
END;
$$;
