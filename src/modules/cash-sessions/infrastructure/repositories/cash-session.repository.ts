import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import { CashSession } from '../../domain/entities/cash-session.entity';
import {
  CashMovementRecord,
  CashSessionRepository,
  CloseCashSessionData,
  CreateCashMovementData,
  OpenCashSessionData,
} from '../../domain/repositories/cash-session.repository';
import { CashSessionValidationService } from '../../domain/services/cash-session-validation.service';

interface CashSessionRow {
  id: number;
  shop_id: number;
  opened_by: number;
  closed_by: number | null;
  opened_at: number;
  closed_at: number | null;
  opening_cash: number;
  opening_momo: number;
  sales_cash: number;
  sales_momo: number;
  expenses_cash: number;
  expenses_momo: number;
  deposits_cash: number;
  deposits_momo: number;
  withdrawals_cash: number;
  withdrawals_momo: number;
  expected_cash: number | null;
  expected_momo: number | null;
  counted_cash: number | null;
  counted_momo: number | null;
  difference_cash: number | null;
  difference_momo: number | null;
  sale_count: number;
  status: 'open' | 'closed';
  closing_note: string | null;
  created_at: number;
  updated_at: number;
}

interface CashMovementRow {
  id: number;
  shop_id: number;
  session_id: number;
  movement_type: 'deposit' | 'withdrawal';
  register_type: string;
  amount: number;
  note: string | null;
  created_by: number;
  created_at: number;
}

@Injectable()
export class SupabaseCashSessionRepository extends CashSessionRepository {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly validation: CashSessionValidationService,
  ) {
    super();
  }

  async listByShop(shopId: number, limit = 50): Promise<CashSession[]> {
    const { data, error } = await this.supabase.db
      .from('cash_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .order('opened_at', { ascending: false })
      .limit(limit);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => this.toDomain(row as CashSessionRow));
  }

  async findOpenByShop(shopId: number): Promise<CashSession | null> {
    const { data, error } = await this.supabase.db
      .from('cash_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) return null;
    return this.toDomain(data as CashSessionRow);
  }

  async findByIdAndShop(id: number, shopId: number): Promise<CashSession | null> {
    const { data, error } = await this.supabase.db
      .from('cash_sessions')
      .select('*')
      .eq('id', id)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) return null;
    return this.toDomain(data as CashSessionRow);
  }

  async openSession(shopId: number, data: OpenCashSessionData): Promise<CashSession> {
    const existing = await this.findOpenByShop(shopId);
    if (existing) {
      throw new ConflictException('Une session de caisse est déjà ouverte.');
    }

    const timestamp = nowMs();
    const row = {
      shop_id: shopId,
      opened_by: data.openedBy,
      opened_at: timestamp,
      opening_cash: data.openingCash,
      opening_momo: data.openingMomo,
      status: 'open',
      created_at: timestamp,
      updated_at: timestamp,
    };

    const { data: inserted, error } = await this.supabase.db
      .from('cash_sessions')
      .insert(row)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return this.toDomain(inserted as CashSessionRow);
  }

  async closeSession(
    shopId: number,
    sessionId: number,
    data: CloseCashSessionData,
  ): Promise<CashSession> {
    const session = await this.findByIdAndShop(sessionId, shopId);
    if (!session) throw new NotFoundException('Session introuvable.');
    if (session.status !== 'open') {
      throw new ConflictException('Cette session est déjà clôturée.');
    }

    const expectedCash = this.validation.computeExpectedCash({
      openingCash: session.openingCash,
      salesCash: data.salesCash,
      depositsCash: data.depositsCash,
      expensesCash: data.expensesCash,
      withdrawalsCash: data.withdrawalsCash,
    });
    const expectedMomo = this.validation.computeExpectedMomo({
      openingMomo: session.openingMomo,
      salesMomo: data.salesMomo,
      depositsMomo: data.depositsMomo,
      expensesMomo: data.expensesMomo,
      withdrawalsMomo: data.withdrawalsMomo,
    });

    const timestamp = nowMs();
    const patch = {
      closed_by: data.closedBy,
      closed_at: timestamp,
      sales_cash: data.salesCash,
      sales_momo: data.salesMomo,
      expenses_cash: data.expensesCash,
      expenses_momo: data.expensesMomo,
      deposits_cash: data.depositsCash,
      deposits_momo: data.depositsMomo,
      withdrawals_cash: data.withdrawalsCash,
      withdrawals_momo: data.withdrawalsMomo,
      expected_cash: expectedCash,
      expected_momo: expectedMomo,
      counted_cash: data.countedCash,
      counted_momo: data.countedMomo,
      difference_cash: data.countedCash - expectedCash,
      difference_momo: data.countedMomo - expectedMomo,
      sale_count: data.saleCount,
      status: 'closed',
      closing_note: data.closingNote ?? null,
      updated_at: timestamp,
    };

    const { data: updated, error } = await this.supabase.db
      .from('cash_sessions')
      .update(patch)
      .eq('id', sessionId)
      .eq('shop_id', shopId)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return this.toDomain(updated as CashSessionRow);
  }

  async listMovements(shopId: number, limit = 200): Promise<CashMovementRecord[]> {
    const { data, error } = await this.supabase.db
      .from('cash_movements')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => this.toMovement(row as CashMovementRow));
  }

  async createMovement(
    shopId: number,
    sessionId: number,
    data: CreateCashMovementData,
  ): Promise<CashMovementRecord> {
    const session = await this.findByIdAndShop(sessionId, shopId);
    if (!session) throw new NotFoundException('Session introuvable.');
    if (session.status !== 'open') {
      throw new ConflictException('Cette session est déjà clôturée.');
    }

    const timestamp = nowMs();
    const { data: inserted, error } = await this.supabase.db
      .from('cash_movements')
      .insert({
        shop_id: shopId,
        session_id: sessionId,
        movement_type: data.movementType,
        register_type: data.registerType,
        amount: data.amount,
        note: data.note ?? null,
        created_by: data.createdBy,
        created_at: timestamp,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return this.toMovement(inserted as CashMovementRow);
  }

  private toMovement(row: CashMovementRow): CashMovementRecord {
    return {
      id: row.id,
      shopId: row.shop_id,
      sessionId: row.session_id,
      movementType: row.movement_type,
      registerType: row.register_type,
      amount: row.amount,
      note: row.note,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  private toDomain(row: CashSessionRow): CashSession {
    return {
      id: row.id,
      shopId: row.shop_id,
      openedBy: row.opened_by,
      closedBy: row.closed_by,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      openingCash: row.opening_cash,
      openingMomo: row.opening_momo,
      salesCash: row.sales_cash,
      salesMomo: row.sales_momo,
      expensesCash: row.expenses_cash,
      expensesMomo: row.expenses_momo,
      depositsCash: row.deposits_cash,
      depositsMomo: row.deposits_momo,
      withdrawalsCash: row.withdrawals_cash,
      withdrawalsMomo: row.withdrawals_momo,
      expectedCash: row.expected_cash,
      expectedMomo: row.expected_momo,
      countedCash: row.counted_cash,
      countedMomo: row.counted_momo,
      differenceCash: row.difference_cash,
      differenceMomo: row.difference_momo,
      saleCount: row.sale_count,
      status: row.status,
      closingNote: row.closing_note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
