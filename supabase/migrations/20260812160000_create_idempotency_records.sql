-- Migration PostgreSQL : Table idempotency_records pour ARIKE Sync Engine v1.0

CREATE TABLE IF NOT EXISTS idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(255) NOT NULL,
  scope VARCHAR(64) NOT NULL DEFAULT 'GLOBAL',
  shop_id INT NOT NULL,
  user_id INT,
  request_hash VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PROCESSING', -- 'PROCESSING', 'COMPLETED', 'FAILED'
  response_status INT,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  CONSTRAINT unique_idempotency_key UNIQUE (shop_id, scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON idempotency_records (shop_id, scope, idempotency_key);
