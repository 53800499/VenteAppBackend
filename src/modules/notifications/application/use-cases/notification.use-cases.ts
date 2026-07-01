import { BadRequestException, Injectable } from '@nestjs/common';
import { beninDayKey } from '../../../../shared/utils/benin-period-range.util';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { NotificationFeed } from '../../domain/entities/notification.entity';
import { NotificationRepository } from '../../domain/repositories/notification.repository';
import { NotificationFeedService } from '../../domain/services/notification-feed.service';
import { UpdateNotificationSettingsDto } from '../dto/notification.dto';

function toPreferencesDto(prefs: NotificationFeed['preferences']) {
  return {
    enableStockAlerts: prefs.enableStockAlerts,
    enableDebtReminders: prefs.enableDebtReminders,
    debtReminderDays: prefs.debtReminderDays,
    enableDailySummary: prefs.enableDailySummary,
    dailySummaryTime: prefs.dailySummaryTime,
    enableBackupReminder: prefs.enableBackupReminder,
    enableGoodDayAlert: prefs.enableGoodDayAlert,
    defaultAlertThreshold: prefs.defaultAlertThreshold,
    backupLastAt: prefs.backupLastAt,
  };
}

function toFeedDto(feed: NotificationFeed) {
  return {
    preferences: toPreferencesDto(feed.preferences),
    debtReminderQuota: feed.debtReminderQuota,
    dailySummary: feed.dailySummary,
    syncConflicts: feed.syncConflicts,
    items: feed.items,
    generatedAt: feed.generatedAt,
  };
}

@Injectable()
export class GetNotificationSettingsUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(auth: AuthContext) {
    const prefs = await this.notifications.getPreferences(auth.shopId);
    return toPreferencesDto(prefs);
  }
}

@Injectable()
export class UpdateNotificationSettingsUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(auth: AuthContext, dto: UpdateNotificationSettingsDto) {
    const payload: Record<string, unknown> = { updated_at: nowMs() };
    if (dto.enableStockAlerts !== undefined) payload.enable_stock_alerts = dto.enableStockAlerts;
    if (dto.enableDebtReminders !== undefined) payload.enable_debt_reminders = dto.enableDebtReminders;
    if (dto.debtReminderDays !== undefined) payload.debt_reminder_days = dto.debtReminderDays;
    if (dto.enableDailySummary !== undefined) payload.enable_daily_summary = dto.enableDailySummary;
    if (dto.dailySummaryTime !== undefined) payload.daily_summary_time = dto.dailySummaryTime;
    if (dto.enableBackupReminder !== undefined) payload.enable_backup_reminder = dto.enableBackupReminder;
    if (dto.enableGoodDayAlert !== undefined) payload.enable_good_day_alert = dto.enableGoodDayAlert;

    if (Object.keys(payload).length === 1) {
      throw new BadRequestException('Aucun paramètre de notification à mettre à jour.');
    }

    const prefs = await this.notifications.updatePreferences(auth.shopId, payload as never);
    return toPreferencesDto(prefs);
  }
}

@Injectable()
export class GetPendingNotificationsUseCase {
  constructor(private readonly feedService: NotificationFeedService) {}

  async execute(auth: AuthContext) {
    const feed = await this.feedService.buildFeed(auth.shopId, nowMs());
    return toFeedDto(feed);
  }
}

@Injectable()
export class AckNotificationsUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(auth: AuthContext, type: 'debt_reminder', count: number) {
    if (type !== 'debt_reminder') {
      throw new BadRequestException('Type d\'acquittement non supporté.');
    }

    const dayKey = beninDayKey(nowMs());
    const quota = await this.notifications.getDebtReminderQuota(auth.shopId, dayKey);
    if (quota.remaining === 0) {
      throw new BadRequestException('Quota journalier de rappels dette atteint (RG-NOTIF-03).');
    }
    if (count > quota.remaining) {
      throw new BadRequestException(
        `Impossible d'acquitter ${count} rappel(s) : il reste ${quota.remaining} slot(s) aujourd'hui.`,
      );
    }

    const updated = await this.notifications.incrementDebtRemindersSent(auth.shopId, dayKey, count);
    return { debtReminderQuota: updated };
  }
}
