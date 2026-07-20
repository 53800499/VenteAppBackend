import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../../../infrastructure/supabase/supabase.service';
import { nowMs } from '../../../../shared/utils/time.util';
import { FxCalculationService } from '../../domain/services/fx-calculation.service';
import {
  CloseFxSessionData,
  CreateFxMovementData,
  CreateFxOperationData,
  CreateFxRateData,
  FxCurrencyRecord,
  FxExchangeRepository,
  FxModuleStatus,
  FxMovementRecord,
  FxOperationRecord,
  FxRateSnapshotRecord,
  FxSessionBalanceRecord,
  FxSessionRecord,
  FxShopCurrencyRecord,
  OpenFxSessionData,
  UpsertShopCurrencyData,
} from '../../domain/repositories/fx-exchange.repository';

const MODULE_CODE = 'FX_EXCHANGE';
const BASE_CURRENCY = 'XOF';

@Injectable()
export class SupabaseFxExchangeRepository extends FxExchangeRepository {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly calc: FxCalculationService,
  ) {
    super();
  }

  async findModuleStatus(
    shopId: number,
    moduleCode: string,
  ): Promise<FxModuleStatus | null> {
    const { data, error } = await this.supabase.db
      .from('tenant_modules')
      .select('enabled')
      .eq('shop_id', shopId)
      .eq('module_code', moduleCode)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) return null;
    return { enabled: data.enabled };
  }

  async toggleModule(
    shopId: number,
    moduleCode: string,
    enabled: boolean,
  ): Promise<FxModuleStatus> {
    const timestamp = nowMs();
    const { data, error } = await this.supabase.db
      .from('tenant_modules')
      .upsert(
        {
          shop_id: shopId,
          module_code: moduleCode,
          enabled,
          created_at: timestamp,
        },
        { onConflict: 'shop_id,module_code' },
      )
      .select('enabled')
      .single();
    if (error) throw new BadRequestException(error.message);

    if (enabled) {
      await this.ensureDefaultShopCurrencies(shopId);
    }

    return { enabled: data.enabled };
  }

  async assertModuleEnabled(shopId: number): Promise<void> {
    const status = await this.findModuleStatus(shopId, MODULE_CODE);
    if (!status?.enabled) {
      throw new ForbiddenException(
        'Le module Bureau de change n\'est pas activé pour cette boutique.',
      );
    }
  }

  async listCurrencies(): Promise<FxCurrencyRecord[]> {
    const { data, error } = await this.supabase.db
      .from('fx_currencies')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => this.toCurrency(row));
  }

  async listShopCurrencies(shopId: number): Promise<FxShopCurrencyRecord[]> {
    const { data, error } = await this.supabase.db
      .from('fx_shop_currencies')
      .select('*')
      .eq('shop_id', shopId)
      .order('sort_order', { ascending: true });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => this.toShopCurrency(row));
  }

  async upsertShopCurrencies(
    shopId: number,
    items: UpsertShopCurrencyData[],
  ): Promise<FxShopCurrencyRecord[]> {
    const hasXof = items.some(
      (item) => item.currencyCode === BASE_CURRENCY && item.enabled,
    );
    if (!hasXof) {
      throw new BadRequestException('La devise FCFA (XOF) doit rester active.');
    }

    const enabledForeign = items.filter(
      (item) => item.currencyCode !== BASE_CURRENCY && item.enabled,
    );
    if (enabledForeign.length < 1) {
      throw new BadRequestException(
        'Au moins une devise étrangère doit être active.',
      );
    }

    const timestamp = nowMs();
    for (const item of items) {
      const { error } = await this.supabase.db.from('fx_shop_currencies').upsert(
        {
          shop_id: shopId,
          currency_code: item.currencyCode,
          enabled: item.enabled,
          sort_order: item.sortOrder,
          updated_at: timestamp,
        },
        { onConflict: 'shop_id,currency_code' },
      );
      if (error) throw new BadRequestException(error.message);
    }

    return this.listShopCurrencies(shopId);
  }

  async createRateSnapshot(
    shopId: number,
    data: CreateFxRateData,
  ): Promise<FxRateSnapshotRecord> {
    if (data.quoteCurrency === BASE_CURRENCY) {
      throw new BadRequestException('Impossible de définir un taux pour FCFA.');
    }

    const timestamp = nowMs();
    const row = {
      shop_id: shopId,
      base_currency: BASE_CURRENCY,
      quote_currency: data.quoteCurrency,
      buy_rate_numerator: data.buyRateNumerator,
      buy_rate_denominator: data.buyRateDenominator,
      sell_rate_numerator: data.sellRateNumerator,
      sell_rate_denominator: data.sellRateDenominator,
      effective_at: timestamp,
      created_by: data.createdBy,
      created_at: timestamp,
    };

    const { data: inserted, error } = await this.supabase.db
      .from('fx_rate_snapshots')
      .insert(row)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return this.toRateSnapshot(inserted);
  }

  async listRateSnapshots(
    shopId: number,
    quoteCurrency?: string,
    limit = 100,
  ): Promise<FxRateSnapshotRecord[]> {
    let query = this.supabase.db
      .from('fx_rate_snapshots')
      .select('*')
      .eq('shop_id', shopId)
      .order('effective_at', { ascending: false })
      .limit(limit);

    if (quoteCurrency) {
      query = query.eq('quote_currency', quoteCurrency);
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => this.toRateSnapshot(row));
  }

  async findLatestRatesForShop(
    shopId: number,
  ): Promise<FxRateSnapshotRecord[]> {
    const shopCurrencies = await this.listShopCurrencies(shopId);
    const quotes = shopCurrencies
      .filter((c) => c.enabled && c.currencyCode !== BASE_CURRENCY)
      .map((c) => c.currencyCode);

    const latest: FxRateSnapshotRecord[] = [];
    for (const quote of quotes) {
      const { data, error } = await this.supabase.db
        .from('fx_rate_snapshots')
        .select('*')
        .eq('shop_id', shopId)
        .eq('quote_currency', quote)
        .order('effective_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new BadRequestException(error.message);
      if (data) latest.push(this.toRateSnapshot(data));
    }
    return latest;
  }

  async listSessions(shopId: number, limit = 50): Promise<FxSessionRecord[]> {
    const { data, error } = await this.supabase.db
      .from('fx_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .order('opened_at', { ascending: false })
      .limit(limit);
    if (error) throw new BadRequestException(error.message);

    const sessions: FxSessionRecord[] = [];
    for (const row of data ?? []) {
      sessions.push(await this.toSessionWithBalances(row));
    }
    return sessions;
  }

  async findOpenSession(shopId: number): Promise<FxSessionRecord | null> {
    const { data, error } = await this.supabase.db
      .from('fx_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) return null;
    return this.toSessionWithBalances(data);
  }

  async findSessionById(
    shopId: number,
    sessionId: number,
  ): Promise<FxSessionRecord | null> {
    const { data, error } = await this.supabase.db
      .from('fx_sessions')
      .select('*')
      .eq('shop_id', shopId)
      .eq('id', sessionId)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) return null;
    return this.toSessionWithBalances(data);
  }

  async openSession(
    shopId: number,
    data: OpenFxSessionData,
  ): Promise<FxSessionRecord> {
    const existing = await this.findOpenSession(shopId);
    if (existing) {
      throw new ConflictException('Une session FX est déjà ouverte.');
    }

    const rates = await this.findLatestRatesForShop(shopId);
    const shopCurrencies = await this.listShopCurrencies(shopId);
    const enabledCodes = shopCurrencies
      .filter((c) => c.enabled)
      .map((c) => c.currencyCode);
    const foreignEnabled = enabledCodes.filter((c) => c !== BASE_CURRENCY);

    if (rates.length < foreignEnabled.length) {
      throw new BadRequestException(
        'Les taux du jour doivent être définis pour toutes les devises actives.',
      );
    }

    const timestamp = nowMs();
    const { data: sessionRow, error } = await this.supabase.db
      .from('fx_sessions')
      .insert({
        shop_id: shopId,
        opened_by: data.openedBy,
        opened_at: timestamp,
        status: 'open',
        created_at: timestamp,
        updated_at: timestamp,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    for (const code of enabledCodes) {
      const opening = data.openingBalances.find((b) => b.currencyCode === code);
      const amount = opening?.amount ?? 0;
      if (amount < 0) {
        throw new BadRequestException(
          `Le solde initial ${code} ne peut pas être négatif.`,
        );
      }
      const { error: balanceError } = await this.supabase.db
        .from('fx_session_balances')
        .insert({
          shop_id: shopId,
          session_id: sessionRow.id,
          currency_code: code,
          opening_balance: amount,
        });
      if (balanceError) throw new BadRequestException(balanceError.message);
    }

    return (await this.findSessionById(shopId, sessionRow.id))!;
  }

  async closeSession(
    shopId: number,
    sessionId: number,
    data: CloseFxSessionData,
  ): Promise<FxSessionRecord> {
    const session = await this.findSessionById(shopId, sessionId);
    if (!session) throw new NotFoundException('Session FX introuvable.');
    if (session.status !== 'open') {
      throw new ConflictException('Cette session FX est déjà clôturée.');
    }

    const liveBalances = await this.computeLiveBalances(shopId, sessionId);
    const timestamp = nowMs();

    for (const balance of session.balances) {
      const expected = liveBalances.get(balance.currencyCode) ?? 0;
      const counted =
        data.countedBalances.find((b) => b.currencyCode === balance.currencyCode)
          ?.amount ?? 0;

      const { error } = await this.supabase.db
        .from('fx_session_balances')
        .update({
          expected_balance: expected,
          counted_balance: counted,
          difference: counted - expected,
        })
        .eq('id', balance.id);
      if (error) throw new BadRequestException(error.message);
    }

    const { error: sessionError } = await this.supabase.db
      .from('fx_sessions')
      .update({
        closed_by: data.closedBy,
        closed_at: timestamp,
        status: 'closed',
        closing_note: data.closingNote,
        updated_at: timestamp,
      })
      .eq('id', sessionId)
      .eq('shop_id', shopId);
    if (sessionError) throw new BadRequestException(sessionError.message);

    return (await this.findSessionById(shopId, sessionId))!;
  }

  async createOperation(
    shopId: number,
    sessionId: number,
    data: CreateFxOperationData,
  ): Promise<FxOperationRecord> {
    const session = await this.findSessionById(shopId, sessionId);
    if (!session) throw new NotFoundException('Session FX introuvable.');
    if (session.status !== 'open') {
      throw new ConflictException('La session FX est clôturée.');
    }

    this.assertFcfaPair(data.fromCurrency, data.toCurrency);

    const quoteCurrency =
      data.fromCurrency === BASE_CURRENCY
        ? data.toCurrency
        : data.fromCurrency;

    const rate = await this.findLatestRate(shopId, quoteCurrency);
    if (!rate) {
      throw new BadRequestException(
        `Aucun taux défini pour ${quoteCurrency}.`,
      );
    }

    let marginFcfa = 0;
    if (data.operationType === 'sell') {
      if (data.fromCurrency !== BASE_CURRENCY) {
        throw new BadRequestException(
          'Une vente de devise exige FCFA en entrée.',
        );
      }
      marginFcfa = this.calc.computeSellMarginFcfa(
        data.fromAmount,
        data.toAmount,
        {
          numerator: rate.buyRateNumerator,
          denominator: rate.buyRateDenominator,
        },
      );
    } else {
      if (data.toCurrency !== BASE_CURRENCY) {
        throw new BadRequestException(
          'Un achat de devise exige FCFA en sortie.',
        );
      }
      marginFcfa = this.calc.computeBuyMarginFcfa(
        data.fromAmount,
        data.toAmount,
        {
          numerator: rate.sellRateNumerator,
          denominator: rate.sellRateDenominator,
        },
      );
    }

    await this.assertBalancesAfterOperation(
      shopId,
      sessionId,
      data,
      data.allowNegativeBalance,
    );

    const timestamp = nowMs();
    const { data: inserted, error } = await this.supabase.db
      .from('fx_operations')
      .insert({
        shop_id: shopId,
        session_id: sessionId,
        operation_type: data.operationType,
        from_currency: data.fromCurrency,
        from_amount: data.fromAmount,
        to_currency: data.toCurrency,
        to_amount: data.toAmount,
        rate_snapshot_id: rate.id,
        margin_fcfa: marginFcfa,
        note: data.note,
        created_by: data.createdBy,
        created_at: timestamp,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    await this.supabase.db
      .from('fx_sessions')
      .update({
        total_margin_fcfa: session.totalMarginFcfa + marginFcfa,
        operation_count: session.operationCount + 1,
        updated_at: timestamp,
      })
      .eq('id', sessionId);

    return this.toOperation(inserted);
  }

  async listOperations(
    shopId: number,
    sessionId?: number,
    limit = 200,
  ): Promise<FxOperationRecord[]> {
    let query = this.supabase.db
      .from('fx_operations')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionId) query = query.eq('session_id', sessionId);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => this.toOperation(row));
  }

  async createMovement(
    shopId: number,
    sessionId: number,
    data: CreateFxMovementData,
  ): Promise<FxMovementRecord> {
    const session = await this.findSessionById(shopId, sessionId);
    if (!session) throw new NotFoundException('Session FX introuvable.');
    if (session.status !== 'open') {
      throw new ConflictException('La session FX est clôturée.');
    }

    if (data.movementType === 'adjustment' && !data.note?.trim()) {
      throw new BadRequestException(
        'Une justification est requise pour un ajustement.',
      );
    }

    const live = await this.computeLiveBalances(shopId, sessionId);
    const current = live.get(data.currencyCode) ?? 0;
    const delta =
      data.movementType === 'withdrawal' ? -data.amount : data.amount;
    const next = current + delta;

    if (next < 0 && !data.allowNegativeBalance) {
      throw new BadRequestException(
        `Solde ${data.currencyCode} insuffisant (${current}).`,
      );
    }

    const timestamp = nowMs();
    const { data: inserted, error } = await this.supabase.db
      .from('fx_movements')
      .insert({
        shop_id: shopId,
        session_id: sessionId,
        currency_code: data.currencyCode,
        movement_type: data.movementType,
        amount: data.amount,
        note: data.note,
        created_by: data.createdBy,
        created_at: timestamp,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);

    return this.toMovement(inserted);
  }

  async listMovements(
    shopId: number,
    sessionId?: number,
    limit = 200,
  ): Promise<FxMovementRecord[]> {
    let query = this.supabase.db
      .from('fx_movements')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (sessionId) query = query.eq('session_id', sessionId);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => this.toMovement(row));
  }

  async computeLiveBalances(
    shopId: number,
    sessionId: number,
  ): Promise<Map<string, number>> {
    const session = await this.findSessionById(shopId, sessionId);
    if (!session) return new Map();

    const balances = new Map<string, number>();
    for (const b of session.balances) {
      balances.set(b.currencyCode, b.openingBalance);
    }

    const operations = await this.listOperations(shopId, sessionId, 10_000);
    for (const op of operations) {
      balances.set(
        op.fromCurrency,
        (balances.get(op.fromCurrency) ?? 0) + op.fromAmount,
      );
      balances.set(
        op.toCurrency,
        (balances.get(op.toCurrency) ?? 0) - op.toAmount,
      );
    }

    const movements = await this.listMovements(shopId, sessionId, 10_000);
    for (const mv of movements) {
      const sign =
        mv.movementType === 'withdrawal' ? -1 : 1;
      balances.set(
        mv.currencyCode,
        (balances.get(mv.currencyCode) ?? 0) + sign * mv.amount,
      );
    }

    return balances;
  }

  private async ensureDefaultShopCurrencies(shopId: number): Promise<void> {
    const existing = await this.listShopCurrencies(shopId);
    if (existing.length > 0) return;

    const currencies = await this.listCurrencies();
    const timestamp = nowMs();
    for (const currency of currencies) {
      const enabled =
        currency.code === BASE_CURRENCY || currency.code === 'NGN';
      await this.supabase.db.from('fx_shop_currencies').upsert(
        {
          shop_id: shopId,
          currency_code: currency.code,
          enabled,
          sort_order: currency.sortOrder,
          created_at: timestamp,
          updated_at: timestamp,
        },
        { onConflict: 'shop_id,currency_code' },
      );
    }
  }

  private async findLatestRate(
    shopId: number,
    quoteCurrency: string,
  ): Promise<FxRateSnapshotRecord | null> {
    const { data, error } = await this.supabase.db
      .from('fx_rate_snapshots')
      .select('*')
      .eq('shop_id', shopId)
      .eq('quote_currency', quoteCurrency)
      .order('effective_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    return data ? this.toRateSnapshot(data) : null;
  }

  private assertFcfaPair(from: string, to: string): void {
    if (from !== BASE_CURRENCY && to !== BASE_CURRENCY) {
      throw new BadRequestException(
        'Une opération doit impliquer FCFA (XOF) en V1.',
      );
    }
    if (from === to) {
      throw new BadRequestException('Les devises doivent être différentes.');
    }
  }

  private async assertBalancesAfterOperation(
    shopId: number,
    sessionId: number,
    data: CreateFxOperationData,
    allowNegative: boolean,
  ): Promise<void> {
    const live = await this.computeLiveBalances(shopId, sessionId);
    const fromNext = (live.get(data.fromCurrency) ?? 0) + data.fromAmount;
    const toNext = (live.get(data.toCurrency) ?? 0) - data.toAmount;

    if (!allowNegative && toNext < 0) {
      throw new BadRequestException(
        `Solde ${data.toCurrency} insuffisant (${live.get(data.toCurrency) ?? 0}).`,
      );
    }
    if (!allowNegative && fromNext < 0) {
      throw new BadRequestException(
        `Solde ${data.fromCurrency} insuffisant.`,
      );
    }
  }

  private async toSessionWithBalances(row: any): Promise<FxSessionRecord> {
    const { data, error } = await this.supabase.db
      .from('fx_session_balances')
      .select('*')
      .eq('session_id', row.id)
      .order('currency_code', { ascending: true });
    if (error) throw new BadRequestException(error.message);

    return {
      id: row.id,
      shopId: row.shop_id,
      openedBy: row.opened_by,
      closedBy: row.closed_by,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      status: row.status,
      closingNote: row.closing_note,
      totalMarginFcfa: row.total_margin_fcfa,
      operationCount: row.operation_count,
      balances: (data ?? []).map((b) => this.toBalance(b)),
    };
  }

  private toCurrency(row: any): FxCurrencyRecord {
    return {
      code: row.code,
      label: row.label,
      symbol: row.symbol,
      minorUnit: row.minor_unit,
      sortOrder: row.sort_order,
    };
  }

  private toShopCurrency(row: any): FxShopCurrencyRecord {
    return {
      id: row.id,
      shopId: row.shop_id,
      currencyCode: row.currency_code,
      enabled: row.enabled,
      sortOrder: row.sort_order,
    };
  }

  private toRateSnapshot(row: any): FxRateSnapshotRecord {
    return {
      id: row.id,
      shopId: row.shop_id,
      baseCurrency: row.base_currency,
      quoteCurrency: row.quote_currency,
      buyRateNumerator: row.buy_rate_numerator,
      buyRateDenominator: row.buy_rate_denominator,
      sellRateNumerator: row.sell_rate_numerator,
      sellRateDenominator: row.sell_rate_denominator,
      effectiveAt: row.effective_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  private toBalance(row: any): FxSessionBalanceRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      shopId: row.shop_id,
      currencyCode: row.currency_code,
      openingBalance: row.opening_balance,
      expectedBalance: row.expected_balance,
      countedBalance: row.counted_balance,
      difference: row.difference,
    };
  }

  private toOperation(row: any): FxOperationRecord {
    return {
      id: row.id,
      shopId: row.shop_id,
      sessionId: row.session_id,
      operationType: row.operation_type,
      fromCurrency: row.from_currency,
      fromAmount: row.from_amount,
      toCurrency: row.to_currency,
      toAmount: row.to_amount,
      rateSnapshotId: row.rate_snapshot_id,
      marginFcfa: row.margin_fcfa,
      note: row.note,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  private toMovement(row: any): FxMovementRecord {
    return {
      id: row.id,
      shopId: row.shop_id,
      sessionId: row.session_id,
      currencyCode: row.currency_code,
      movementType: row.movement_type,
      amount: row.amount,
      note: row.note,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}
