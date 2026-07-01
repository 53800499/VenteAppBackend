import { Injectable } from '@nestjs/common';
import {
  beninDayKey,
  beninDayStart,
  beninMonthStartMs,
} from '../../../../shared/utils/benin-period-range.util';
import {
  DailySummaryPreview,
  DebtReminderQuota,
  NotificationFeed,
  NotificationItem,
  NotificationPreferences,
  SyncConflictSummary,
} from '../entities/notification.entity';
import { NotificationRepository } from '../repositories/notification.repository';

const BACKUP_REMINDER_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationFeedService {
  constructor(private readonly notifications: NotificationRepository) {}

  async buildFeed(shopId: number, nowMs: number): Promise<NotificationFeed> {
    const [preferences, dayKey] = await Promise.all([
      this.notifications.getPreferences(shopId),
      Promise.resolve(beninDayKey(nowMs)),
    ]);
    const quota = await this.notifications.getDebtReminderQuota(shopId, dayKey);

    const [
      lowStock,
      debtCandidates,
      todayStats,
      monthBestDay,
      syncConflicts,
    ] = await Promise.all([
      preferences.enableStockAlerts
        ? this.notifications.loadLowStockProducts(shopId, preferences.defaultAlertThreshold)
        : Promise.resolve([]),
      preferences.enableDebtReminders && quota.remaining > 0
        ? this.notifications.loadDebtReminderCandidates(
            shopId,
            preferences.debtReminderDays,
            quota.remaining,
          )
        : Promise.resolve([]),
      this.notifications.loadTodaySalesStats(
        shopId,
        beninDayStart(nowMs),
        nowMs,
      ),
      preferences.enableGoodDayAlert
        ? this.notifications.loadMonthBestDayRevenue(shopId, beninMonthStartMs(nowMs), nowMs)
        : Promise.resolve(0),
      this.notifications.loadSyncConflicts(shopId),
    ]);

    const dailySummary = this.buildDailySummary(preferences, todayStats);
    const items: NotificationItem[] = [];

    if (preferences.enableStockAlerts && lowStock.length > 0) {
      const names = lowStock.slice(0, 3).map((p) => p.name).join(', ');
      const extra = lowStock.length > 3 ? ` et ${lowStock.length - 3} autre(s)` : '';
      items.push({
        code: 'N-01',
        channel: 'stock',
        title: 'Stock faible',
        body: `${lowStock.length} produit(s) sous le seuil : ${names}${extra}.`,
        deepLink: '/products/low-stock',
        configurable: true,
        alwaysOn: false,
        payload: { productIds: lowStock.map((p) => p.id), count: lowStock.length },
      });
    }

    for (const debt of debtCandidates) {
      items.push({
        code: 'N-02',
        channel: 'debt',
        title: 'Rappel dette',
        body: `${debt.customerName} doit ${debt.amountRemaining} FCFA (${debt.daysWithoutPayment} j. sans paiement).`,
        deepLink: `/customers/${debt.customerId}`,
        configurable: true,
        alwaysOn: false,
        payload: {
          debtId: debt.debtId,
          customerId: debt.customerId,
          amountRemaining: debt.amountRemaining,
          daysWithoutPayment: debt.daysWithoutPayment,
        },
      });
    }

    if (preferences.enableBackupReminder && this.isBackupOverdue(preferences.backupLastAt, nowMs)) {
      items.push({
        code: 'N-05',
        channel: 'system',
        title: 'Sauvegarde recommandée',
        body: 'Votre dernière sauvegarde date de plus de 7 jours. Pensez à exporter vos données.',
        deepLink: '/settings/backup',
        configurable: true,
        alwaysOn: false,
        payload: { backupLastAt: preferences.backupLastAt },
      });
    }

    if (
      preferences.enableGoodDayAlert &&
      todayStats.saleCount > 0 &&
      todayStats.totalRevenue > monthBestDay
    ) {
      items.push({
        code: 'N-06',
        channel: 'summary',
        title: 'Bonne journée !',
        body: `Record du mois : ${todayStats.totalRevenue} FCFA de CA aujourd'hui.`,
        deepLink: '/reports?period=today',
        configurable: true,
        alwaysOn: false,
        payload: {
          todayRevenue: todayStats.totalRevenue,
          previousBest: monthBestDay,
        },
      });
    }

    if (syncConflicts.count > 0) {
      items.push({
        code: 'N-07',
        channel: 'sync',
        title: 'Conflit de synchronisation',
        body: `${syncConflicts.count} enregistrement(s) en conflit — résolution requise.`,
        deepLink: '/sync/conflicts',
        configurable: false,
        alwaysOn: true,
        payload: { entities: syncConflicts.entities },
      });
    }

    return new NotificationFeed(
      preferences,
      quota,
      dailySummary,
      syncConflicts,
      items,
      nowMs,
    );
  }

  private buildDailySummary(
    preferences: NotificationPreferences,
    todayStats: { saleCount: number; totalRevenue: number },
  ): DailySummaryPreview {
    if (!preferences.enableDailySummary) {
      return {
        eligible: false,
        scheduledTime: preferences.dailySummaryTime,
        saleCount: todayStats.saleCount,
        totalRevenue: todayStats.totalRevenue,
        reason: 'Résumé journalier désactivé',
      };
    }
    if (todayStats.saleCount === 0) {
      return {
        eligible: false,
        scheduledTime: preferences.dailySummaryTime,
        saleCount: 0,
        totalRevenue: 0,
        reason: 'Aucune vente aujourd\'hui (RG-NOTIF-04)',
      };
    }
    return {
      eligible: true,
      scheduledTime: preferences.dailySummaryTime,
      saleCount: todayStats.saleCount,
      totalRevenue: todayStats.totalRevenue,
    };
  }

  private isBackupOverdue(backupLastAt: number | null, nowMs: number): boolean {
    if (backupLastAt == null) return true;
    return nowMs - backupLastAt >= BACKUP_REMINDER_AGE_MS;
  }
}
