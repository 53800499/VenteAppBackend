import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { beninDayKey, beninDayStart } from '../../../../shared/utils/benin-period-range.util';
import { throwSupabaseError } from '../../../../shared/utils/throw-supabase-error.util';
import {
  DebtReminderQuota,
  MAX_DEBT_REMINDERS_PER_DAY,
  NotificationPreferences,
  SyncConflictSummary,
} from '../../domain/entities/notification.entity';
import {
  NotificationRepository,
  UpdateNotificationPreferencesData,
} from '../../domain/repositories/notification.repository';
import {
  NotificationDailyStateRow,
  NotificationSettingsRow,
} from '../persistence/notification.row';

interface DebtRow {
  id: number;
  customer_id: number;
  amount_remaining: number;
  amount_paid: number;
  created_at: number;
  customers?: { name: string } | { name: string }[] | null;
}

interface DebtPaymentRow {
  debt_id: number;
  created_at: number;
}

interface ProductRow {
  id: number;
  name: string;
  quantity_in_stock: number;
  alert_threshold: number | null;
  is_archived: boolean;
}

interface SaleRow {
  total_amount: number;
  created_at: number;
}

@Injectable()
export class SupabaseNotificationRepository extends NotificationRepository {
  constructor(private readonly supabase: SupabaseService) {
    super();
  }

  async getPreferences(shopId: number): Promise<NotificationPreferences> {
    const row = await this.fetchSettingsRow(shopId);
    if (!row) {
      throw new NotFoundException('Paramètres boutique introuvables.');
    }
    return this.mapPreferences(row);
  }

  async updatePreferences(
    shopId: number,
    data: UpdateNotificationPreferencesData,
  ): Promise<NotificationPreferences> {
    const { error } = await this.supabase.db.from('settings').update(data).eq('shop_id', shopId);
    if (error) throwSupabaseError(error);
    return this.getPreferences(shopId);
  }

  async getDebtReminderQuota(shopId: number, dayKey: string): Promise<DebtReminderQuota> {
    const { data, error } = await this.supabase.db
      .from('notification_daily_state')
      .select('debt_reminders_sent')
      .eq('shop_id', shopId)
      .eq('day_key', dayKey)
      .maybeSingle();
    if (error) throwSupabaseError(error);

    const sent = (data as NotificationDailyStateRow | null)?.debt_reminders_sent ?? 0;
    return {
      sent,
      max: MAX_DEBT_REMINDERS_PER_DAY,
      remaining: Math.max(0, MAX_DEBT_REMINDERS_PER_DAY - sent),
      dayKey,
    };
  }

  async incrementDebtRemindersSent(
    shopId: number,
    dayKey: string,
    count: number,
  ): Promise<DebtReminderQuota> {
    const current = await this.getDebtReminderQuota(shopId, dayKey);
    const nextSent = Math.min(MAX_DEBT_REMINDERS_PER_DAY, current.sent + count);
    const now = Date.now();

    const { error } = await this.supabase.db.from('notification_daily_state').upsert(
      {
        shop_id: shopId,
        day_key: dayKey,
        debt_reminders_sent: nextSent,
        updated_at: now,
      },
      { onConflict: 'shop_id,day_key' },
    );
    if (error) throwSupabaseError(error);

    return {
      sent: nextSent,
      max: MAX_DEBT_REMINDERS_PER_DAY,
      remaining: Math.max(0, MAX_DEBT_REMINDERS_PER_DAY - nextSent),
      dayKey,
    };
  }

  async loadLowStockProducts(
    shopId: number,
    threshold: number,
  ): Promise<{ id: number; name: string; quantity: number }[]> {
    const { data, error } = await this.supabase.db
      .from('products')
      .select('id, name, quantity_in_stock, alert_threshold, is_archived')
      .eq('shop_id', shopId)
      .eq('is_archived', false);
    if (error) throw new BadRequestException(error.message);

    return (data as ProductRow[])
      .filter((p) => {
        const effective = p.alert_threshold ?? threshold;
        return p.quantity_in_stock <= effective;
      })
      .sort((a, b) => a.quantity_in_stock - b.quantity_in_stock)
      .map((p) => ({
        id: p.id,
        name: p.name,
        quantity: p.quantity_in_stock,
      }));
  }

  async loadDebtReminderCandidates(
    shopId: number,
    minDaysWithoutPayment: number,
    limit: number,
  ): Promise<
    {
      debtId: number;
      customerId: number;
      customerName: string;
      amountRemaining: number;
      daysWithoutPayment: number;
    }[]
  > {
    if (limit <= 0) return [];

    const { data: debts, error } = await this.supabase.db
      .from('debts')
      .select('id, customer_id, amount_remaining, amount_paid, created_at, customers(name)')
      .eq('shop_id', shopId)
      .in('status', ['open', 'partial']);
    if (error) throw new BadRequestException(error.message);

    const debtRows = (debts ?? []) as DebtRow[];
    if (debtRows.length === 0) return [];

    const debtIds = debtRows.map((d) => d.id);
    const { data: payments, error: payError } = await this.supabase.db
      .from('debt_payments')
      .select('debt_id, created_at')
      .eq('shop_id', shopId)
      .in('debt_id', debtIds)
      .order('created_at', { ascending: false });
    if (payError) throw new BadRequestException(payError.message);

    const lastPaymentByDebt = new Map<number, number>();
    for (const row of (payments ?? []) as DebtPaymentRow[]) {
      if (!lastPaymentByDebt.has(row.debt_id)) {
        lastPaymentByDebt.set(row.debt_id, row.created_at);
      }
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const candidates = debtRows
      .map((debt) => {
        const lastPay = lastPaymentByDebt.get(debt.id) ?? null;
        const days =
          debt.amount_paid === 0
            ? Math.floor((now - debt.created_at) / dayMs)
            : lastPay == null
              ? 0
              : Math.floor((now - lastPay) / dayMs);
        const customerRel = debt.customers;
        const customerName = Array.isArray(customerRel)
          ? customerRel[0]?.name
          : customerRel?.name;
        return {
          debtId: debt.id,
          customerId: debt.customer_id,
          customerName: customerName ?? 'Client',
          amountRemaining: debt.amount_remaining,
          daysWithoutPayment: days,
        };
      })
      .filter((d) => d.daysWithoutPayment >= minDaysWithoutPayment)
      .sort((a, b) => b.daysWithoutPayment - a.daysWithoutPayment)
      .slice(0, limit);

    return candidates;
  }

  async loadTodaySalesStats(
    shopId: number,
    dayStartMs: number,
    dayEndMs: number,
  ): Promise<{ saleCount: number; totalRevenue: number }> {
    const { data, error } = await this.supabase.db
      .from('sales')
      .select('total_amount, created_at')
      .eq('shop_id', shopId)
      .neq('status', 'cancelled')
      .gte('created_at', dayStartMs)
      .lte('created_at', dayEndMs);
    if (error) throw new BadRequestException(error.message);

    const rows = (data ?? []) as SaleRow[];
    return {
      saleCount: rows.length,
      totalRevenue: rows.reduce((sum, row) => sum + row.total_amount, 0),
    };
  }

  async loadMonthBestDayRevenue(shopId: number, monthStartMs: number, nowMs: number): Promise<number> {
    const dayStart = monthStartMs;
    const todayStart = beninDayStart(nowMs);

    const { data, error } = await this.supabase.db
      .from('sales')
      .select('total_amount, created_at')
      .eq('shop_id', shopId)
      .neq('status', 'cancelled')
      .gte('created_at', dayStart)
      .lt('created_at', todayStart);
    if (error) throw new BadRequestException(error.message);

    const dailyTotals = new Map<string, number>();
    for (const row of (data ?? []) as SaleRow[]) {
      const key = beninDayKey(row.created_at);
      dailyTotals.set(key, (dailyTotals.get(key) ?? 0) + row.total_amount);
    }

    let best = 0;
    for (const total of dailyTotals.values()) {
      if (total > best) best = total;
    }
    return best;
  }

  async loadSyncConflicts(shopId: number): Promise<SyncConflictSummary> {
    const tables = ['products', 'sales', 'payments'] as const;
    const entities: { table: string; id: number }[] = [];

    await Promise.all(
      tables.map(async (table) => {
        const { data, error } = await this.supabase.db
          .from(table)
          .select('id')
          .eq('shop_id', shopId)
          .eq('sync_status', 'conflict');
        if (error) throw new BadRequestException(error.message);
        for (const row of data ?? []) {
          entities.push({ table, id: row.id as number });
        }
      }),
    );

    return { count: entities.length, entities };
  }

  private async fetchSettingsRow(shopId: number): Promise<NotificationSettingsRow | null> {
    const { data, error } = await this.supabase.db
      .from('settings')
      .select(
        'enable_stock_alerts, enable_debt_reminders, debt_reminder_days, enable_daily_summary, daily_summary_time, default_alert_threshold, backup_last_at, enable_backup_reminder, enable_good_day_alert',
      )
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throwSupabaseError(error);
    return (data as NotificationSettingsRow | null) ?? null;
  }

  private mapPreferences(row: NotificationSettingsRow): NotificationPreferences {
    return new NotificationPreferences(
      row.enable_stock_alerts,
      row.enable_debt_reminders,
      row.debt_reminder_days,
      row.enable_daily_summary,
      row.daily_summary_time,
      row.enable_backup_reminder ?? true,
      row.enable_good_day_alert ?? true,
      row.default_alert_threshold,
      row.backup_last_at,
    );
  }
}
