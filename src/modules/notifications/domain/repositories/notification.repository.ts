import {
  DebtReminderQuota,
  NotificationPreferences,
  SyncConflictSummary,
} from '../entities/notification.entity';

export interface UpdateNotificationPreferencesData {
  enable_stock_alerts?: boolean;
  enable_debt_reminders?: boolean;
  debt_reminder_days?: number;
  enable_daily_summary?: boolean;
  daily_summary_time?: string;
  enable_backup_reminder?: boolean;
  enable_good_day_alert?: boolean;
  updated_at: number;
}

export abstract class NotificationRepository {
  abstract getPreferences(shopId: number): Promise<NotificationPreferences>;
  abstract updatePreferences(shopId: number, data: UpdateNotificationPreferencesData): Promise<NotificationPreferences>;
  abstract getDebtReminderQuota(shopId: number, dayKey: string): Promise<DebtReminderQuota>;
  abstract incrementDebtRemindersSent(shopId: number, dayKey: string, count: number): Promise<DebtReminderQuota>;
  abstract loadLowStockProducts(shopId: number, threshold: number): Promise<{ id: number; name: string; quantity: number }[]>;
  abstract loadDebtReminderCandidates(
    shopId: number,
    minDaysWithoutPayment: number,
    limit: number,
  ): Promise<{ debtId: number; customerId: number; customerName: string; amountRemaining: number; daysWithoutPayment: number }[]>;
  abstract loadTodaySalesStats(shopId: number, dayStartMs: number, dayEndMs: number): Promise<{ saleCount: number; totalRevenue: number }>;
  abstract loadMonthBestDayRevenue(shopId: number, monthStartMs: number, nowMs: number): Promise<number>;
  abstract loadSyncConflicts(shopId: number): Promise<SyncConflictSummary>;
}
