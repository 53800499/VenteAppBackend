-- VenteApp — Module 12 Audit (index consultation journal par boutique)

CREATE INDEX IF NOT EXISTS idx_auditlogs_shop_created
  ON audit_logs(shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditlogs_shop_module
  ON audit_logs(shop_id, module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditlogs_shop_user
  ON audit_logs(shop_id, user_id, created_at DESC);
