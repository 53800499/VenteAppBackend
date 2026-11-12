-- 058_subscription_entitlement_hardening.sql
-- Durcissement SaaS du moteur d'abonnement : idempotence atomique, downgrades programmés,
-- journal des transitions et audit des webhooks FedaPay.

-- 1. Contrainte UNIQUE sur payment_reference pour empêcher tout double traitement concurrent
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_payment_reference_unique
  ON subscriptions (payment_reference)
  WHERE payment_reference IS NOT NULL;

-- 2. Colonnes de changement programmé sur subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_plan_code TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_duration_days INTEGER,
  ADD COLUMN IF NOT EXISTS scheduled_effective_at TIMESTAMPTZ;

-- 3. Journal des transitions d'abonnement (audit commercial)
CREATE TABLE IF NOT EXISTS subscription_transitions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  shop_id BIGINT,
  from_plan TEXT,
  to_plan TEXT NOT NULL,
  transition_type TEXT NOT NULL, -- NEW_SUBSCRIPTION | RENEWAL | UPGRADE | DOWNGRADE | DOWNGRADE_SCHEDULED | ADMIN_EXTENSION | PLAN_CHANGE_FREE
  bonus_days INTEGER DEFAULT 0,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_reference TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_transitions_tenant
  ON subscription_transitions (tenant_id, created_at DESC);

-- 4. Journal des événements webhook FedaPay (audit & retraitement)
CREATE TABLE IF NOT EXISTS fedapay_webhook_events (
  id BIGSERIAL PRIMARY KEY,
  tx_id BIGINT,
  event_name TEXT,
  status TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fedapay_webhook_events_tx
  ON fedapay_webhook_events (tx_id, created_at DESC);

