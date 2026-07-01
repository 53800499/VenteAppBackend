export type NotificationCode = 'N-01' | 'N-02' | 'N-03' | 'N-04' | 'N-05' | 'N-06' | 'N-07';

export const MAX_DEBT_REMINDERS_PER_DAY = 3;

export type NotificationChannel =
  | 'stock'
  | 'debt'
  | 'summary'
  | 'system'
  | 'sync';

export class NotificationPreferences {
  constructor(
    public readonly enableStockAlerts: boolean,
    public readonly enableDebtReminders: boolean,
    public readonly debtReminderDays: number,
    public readonly enableDailySummary: boolean,
    public readonly dailySummaryTime: string,
    public readonly enableBackupReminder: boolean,
    public readonly enableGoodDayAlert: boolean,
    public readonly defaultAlertThreshold: number,
    public readonly backupLastAt: number | null,
  ) {}
}

export interface NotificationItem {
  code: NotificationCode;
  channel: NotificationChannel;
  title: string;
  body: string;
  deepLink: string;
  configurable: boolean;
  alwaysOn: boolean;
  payload: Record<string, unknown>;
}

export interface DebtReminderQuota {
  sent: number;
  max: number;
  remaining: number;
  dayKey: string;
}

export interface DailySummaryPreview {
  eligible: boolean;
  scheduledTime: string;
  saleCount: number;
  totalRevenue: number;
  reason?: string;
}

export interface SyncConflictSummary {
  count: number;
  entities: { table: string; id: number }[];
}

export class NotificationFeed {
  constructor(
    public readonly preferences: NotificationPreferences,
    public readonly debtReminderQuota: DebtReminderQuota,
    public readonly dailySummary: DailySummaryPreview,
    public readonly syncConflicts: SyncConflictSummary,
    public readonly items: NotificationItem[],
    public readonly generatedAt: number,
  ) {}
}
