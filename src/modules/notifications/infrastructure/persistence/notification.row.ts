export interface NotificationSettingsRow {
  enable_stock_alerts: boolean;
  enable_debt_reminders: boolean;
  debt_reminder_days: number;
  enable_daily_summary: boolean;
  daily_summary_time: string;
  enable_backup_reminder?: boolean;
  enable_good_day_alert?: boolean;
  default_alert_threshold: number;
  backup_last_at: number | null;
}

export interface NotificationDailyStateRow {
  shop_id: number;
  day_key: string;
  debt_reminders_sent: number;
  updated_at: number;
}
