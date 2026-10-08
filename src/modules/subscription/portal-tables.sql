-- ============================================================
-- ARIKE — Tables du portail d'abonnement public
-- À exécuter dans Supabase SQL Editor ou via migration
-- ============================================================

-- Table des sessions de paiement (durée : 30 min)
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id                    TEXT PRIMARY KEY,              -- "cs_" + nanoid(20)
  plan_code             TEXT NOT NULL,                 -- ESSENTIEL | PRO | BUSINESS
  duration_days         INT  NOT NULL DEFAULT 30,
  amount                NUMERIC NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'FCFA',
  customer_name         TEXT NOT NULL,
  customer_phone        TEXT NOT NULL,
  customer_email        TEXT,
  tenant_id             TEXT,                          -- NULL pour nouveaux commerçants
  fedapay_transaction_id TEXT,                         -- renseigné après initiation paiement
  fedapay_reference     TEXT,                         -- renseigné après webhook
  status                TEXT NOT NULL DEFAULT 'PENDING',
  -- PENDING | PAID | COMPLETED | EXPIRED
  paid_at               TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour idempotence webhook FedaPay
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_sessions_fedapay_txid
  ON checkout_sessions (fedapay_transaction_id)
  WHERE fedapay_transaction_id IS NOT NULL;

-- Index pour recherche rapide par tenant
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_tenant
  ON checkout_sessions (tenant_id)
  WHERE tenant_id IS NOT NULL;

-- ============================================================

-- Table des sessions portail de gestion (durée : 24h)
CREATE TABLE IF NOT EXISTS portal_sessions (
  id         TEXT PRIMARY KEY,              -- "ps_" + nanoid(20)
  tenant_id  TEXT NOT NULL,
  shop_id    INT  NOT NULL,
  status     TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | EXPIRED
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_tenant
  ON portal_sessions (tenant_id);

-- ============================================================
-- Trigger pour updated_at automatique sur checkout_sessions
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_checkout_sessions_updated_at ON checkout_sessions;
CREATE TRIGGER set_checkout_sessions_updated_at
  BEFORE UPDATE ON checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
