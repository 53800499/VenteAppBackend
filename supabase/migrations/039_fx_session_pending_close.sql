-- ARIKE — Clôture FX en 2 temps : open → pending_close → closed

ALTER TABLE fx_sessions DROP CONSTRAINT IF EXISTS fx_sessions_status_check;

ALTER TABLE fx_sessions
  ADD CONSTRAINT fx_sessions_status_check
  CHECK (status IN ('open', 'pending_close', 'closed'));

DROP INDEX IF EXISTS idx_fx_sessions_one_open_per_shop;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fx_sessions_one_active_per_shop
  ON fx_sessions(shop_id)
  WHERE status IN ('open', 'pending_close');
