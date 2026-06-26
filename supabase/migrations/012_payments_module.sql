-- VenteApp — Module 5 Paiements & dettes (alignement BDD v2.0)

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  sale_id         BIGINT      REFERENCES sales(id) ON DELETE SET NULL,
  debt_id         BIGINT      REFERENCES debts(id) ON DELETE SET NULL,
  customer_id     BIGINT      REFERENCES customers(id) ON DELETE SET NULL,
  user_id         BIGINT      NOT NULL REFERENCES users(id),
  receipt_number  TEXT,
  amount          BIGINT      NOT NULL CHECK (amount > 0),
  method          TEXT        NOT NULL
                  CHECK (method IN ('cash', 'mtn_momo', 'moov_money', 'other')),
  reference       TEXT,
  change_given    BIGINT      NOT NULL DEFAULT 0 CHECK (change_given >= 0),
  status          TEXT        NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  note            TEXT,
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  version         INTEGER     NOT NULL DEFAULT 1,
  server_id       UUID        DEFAULT gen_random_uuid() UNIQUE,
  sync_status     TEXT        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  CHECK (sale_id IS NOT NULL OR debt_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_payments_shop ON payments(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_debt ON payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method);

-- ---------------------------------------------------------------------------
-- debt_payments (historique remboursements)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS debt_payments (
  id              BIGSERIAL PRIMARY KEY,
  shop_id         BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  debt_id         BIGINT      NOT NULL REFERENCES debts(id) ON DELETE RESTRICT,
  payment_id      BIGINT      NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  user_id         BIGINT      NOT NULL REFERENCES users(id),
  amount          BIGINT      NOT NULL CHECK (amount > 0),
  method          TEXT        NOT NULL
                  CHECK (method IN ('cash', 'mtn_momo', 'moov_money', 'other')),
  reference       TEXT,
  created_at      BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debt_payments_payment ON debt_payments(payment_id);

-- ---------------------------------------------------------------------------
-- debts — colonnes SFD v2.0
-- ---------------------------------------------------------------------------
ALTER TABLE debts
  ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS forgiven_by_user_id BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS forgiven_at BIGINT,
  ADD COLUMN IF NOT EXISTS forgiven_reason TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS updated_at BIGINT;

UPDATE debts
SET updated_at = COALESCE(updated_at, created_at)
WHERE updated_at IS NULL;

UPDATE debts SET status = 'paid' WHERE status = 'closed';

ALTER TABLE debts DROP CONSTRAINT IF EXISTS debts_status_check;
ALTER TABLE debts ADD CONSTRAINT debts_status_check
  CHECK (status IN ('open', 'partial', 'paid', 'cancelled', 'forgiven'));

CREATE INDEX IF NOT EXISTS idx_debts_status_created ON debts(shop_id, status, created_at ASC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
DO $payments_rls$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['payments', 'debt_payments']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_all ON %I', tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I_tenant_all ON %I FOR ALL USING (app_allows_shop(shop_id)) WITH CHECK (app_allows_shop(shop_id))',
      tbl, tbl
    );
  END LOOP;
END $payments_rls$;
