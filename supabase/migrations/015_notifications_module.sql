-- VenteApp — Module 9 Notifications (quota rappels dette RG-NOTIF-03)

CREATE TABLE IF NOT EXISTS notification_daily_state (
  shop_id                 BIGINT      NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  day_key                 TEXT        NOT NULL,
  debt_reminders_sent     INTEGER     NOT NULL DEFAULT 0 CHECK (debt_reminders_sent >= 0),
  updated_at              BIGINT      NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  PRIMARY KEY (shop_id, day_key)
);

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS enable_backup_reminder BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS enable_good_day_alert BOOLEAN NOT NULL DEFAULT TRUE;

DO $notif_rls$
BEGIN
  ALTER TABLE notification_daily_state ENABLE ROW LEVEL SECURITY;
  ALTER TABLE notification_daily_state FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS notification_daily_state_tenant_all ON notification_daily_state;
  CREATE POLICY notification_daily_state_tenant_all ON notification_daily_state
    FOR ALL USING (app_allows_shop(shop_id)) WITH CHECK (app_allows_shop(shop_id));
END $notif_rls$;
