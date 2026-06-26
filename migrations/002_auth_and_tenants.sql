-- ============================================================
-- 002_auth_and_tenants.sql
-- Multi-tenant core: tenants, boutiques, users, roles, RBAC
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tenants ─────────────────────────────────────────────────
CREATE TABLE tenants (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(150) NOT NULL,
  slug         VARCHAR(80)  NOT NULL UNIQUE,
  plan         VARCHAR(50)  NOT NULL DEFAULT 'trial',
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  trial_ends_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Boutiques ───────────────────────────────────────────────
CREATE TABLE boutiques (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(150) NOT NULL,
  prefix       VARCHAR(20)  NOT NULL,           -- e.g. "elmo" → ref "elmo0031"
  domain       VARCHAR(255),
  order_seq    INTEGER      NOT NULL DEFAULT 0, -- auto-increment per boutique
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, prefix)
);

CREATE INDEX idx_boutiques_tenant ON boutiques(tenant_id);

-- ── Roles ───────────────────────────────────────────────────
CREATE TABLE roles (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  -- Stored as flat JSON object: { "orders.en_confirmation.confirm": true, ... }
  -- Keys follow pattern: "module.section.action"
  permissions JSONB        NOT NULL DEFAULT '{}',
  is_system   BOOLEAN      NOT NULL DEFAULT FALSE, -- Super Admin role, undeletable
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_roles_tenant ON roles(tenant_id);

-- ── Users ───────────────────────────────────────────────────
CREATE TABLE users (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             VARCHAR(150) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  password_hash    VARCHAR(255) NOT NULL,
  email_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
  email_verify_token VARCHAR(100),
  two_fa_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,
  two_fa_secret    VARCHAR(100),                -- TOTP secret, encrypted at rest
  is_online        BOOLEAN      NOT NULL DEFAULT FALSE,
  last_seen_at     TIMESTAMPTZ,
  is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant   ON users(tenant_id);
CREATE INDEX idx_users_email    ON users(email);

-- ── User ↔ Role (N:N) ───────────────────────────────────────
CREATE TABLE user_roles (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  role_id   UUID NOT NULL REFERENCES roles(id)  ON DELETE CASCADE,
  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- ── User ↔ Boutique access (N:N) ────────────────────────────
CREATE TABLE user_boutiques (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  boutique_id UUID NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  UNIQUE(user_id, boutique_id)
);

CREATE INDEX idx_user_boutiques_user     ON user_boutiques(user_id);
CREATE INDEX idx_user_boutiques_boutique ON user_boutiques(boutique_id);

-- ── Sessions ────────────────────────────────────────────────
CREATE TABLE sessions (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     VARCHAR(255) NOT NULL UNIQUE,
  ip_address     INET,
  user_agent     TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user       ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX idx_sessions_expires    ON sessions(expires_at);

-- ── Audit log ───────────────────────────────────────────────
-- Covers "voir les journaux des commandes" permission
CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(80)  NOT NULL,   -- 'order', 'product', 'user', ...
  entity_id   UUID,
  action      VARCHAR(80)  NOT NULL,   -- 'create', 'update', 'delete', 'status_change', ...
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant      ON audit_logs(tenant_id);
CREATE INDEX idx_audit_entity      ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user        ON audit_logs(user_id);
CREATE INDEX idx_audit_created     ON audit_logs(created_at DESC);

-- ── Seed: default permission keys ───────────────────────────
-- Super Admin role created per-tenant on signup (handled in app)
-- Permission key reference (stored as JSONB keys):
--   orders.en_confirmation.view | confirm | cancel | delete | assign_confirmer
--   orders.en_confirmation.edit_discount | edit_price | edit_delivery_fee | bulk_action
--   orders.en_preparation.view | go_back | cancel | change_carrier | dispatch
--   orders.en_preparation.print_labels | export | edit | edit_discount | bulk_action
--   orders.en_dispatch.view | cancel | go_back | change_carrier | print_labels
--   orders.en_dispatch.print_route | ship | export | edit | disable_sync | bulk_action
--   orders.en_livraison.view | go_back | track | request_return | validate_delivery
--   orders.en_livraison.edit | edit_carrier_fee | disable_sync | bulk_action
--   orders.livrees.view | go_back | prepare_bon | edit | edit_carrier_fee | bulk_action
--   orders.en_retour.view | go_back | prepare_bon | validate_return | edit | bulk_action
--   orders.archive_encaissees.view | go_back | bulk_action
--   orders.archive_retournees.view | go_back | bulk_action
--   orders.archive_annulees.view | delete | restore | bulk_action
--   orders.corbeille.view | undo_delete | bulk_action
--   orders.bon_encaissement.view | go_back | confirm | bulk_action
--   orders.bon_retour.view | go_back | confirm | bulk_action
--   orders.pickups_en_collecte.view | go_back | cancel | delete | edit | validate_collect | disable_sync | bulk_action
--   orders.pickups_collecte.view | go_back | edit | prepare_bon | validate_reception | disable_sync | bulk_action
--   orders.pickups_recus.view | go_back | edit | validate_processing | bulk_action
--   orders.pickups_traites.view | go_back | bulk_action
--   orders.pickups_annules.view | go_back | delete | bulk_action
--   stats.boutique | stats.product | stats.delivery | stats.confirmation | stats.order
--   data.export | data.reports
--   products.view | create | edit | trash | move_to_trash | restore | delete
--   stock.adjust | stock.movements | stock.batches | stock.alerts | stock.inventory
--   stock.mega_inventory | stock.view_purchase_price
--   brands.create | edit | delete
--   suppliers.create | edit | delete
--   accounting.bilan | accounting.product_profitability | accounting.enter_expenses
--   webhooks.create | edit | delete | view_logs
--   config.sources | config.clients | config.delivery | config.boutiques
--   config.statuses | config.users | config.roles | config.subscription | config.advanced
--   other.view_unassigned_orders | other.view_order_logs
