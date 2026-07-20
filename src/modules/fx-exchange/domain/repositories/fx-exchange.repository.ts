export interface FxModuleStatus {
  enabled: boolean;
}

export interface FxCurrencyRecord {
  code: string;
  label: string;
  symbol: string;
  minorUnit: number;
  sortOrder: number;
}

export interface FxShopCurrencyRecord {
  id: number;
  shopId: number;
  currencyCode: string;
  enabled: boolean;
  sortOrder: number;
}

export interface FxRateSnapshotRecord {
  id: number;
  shopId: number;
  baseCurrency: string;
  quoteCurrency: string;
  buyRateNumerator: number;
  buyRateDenominator: number;
  sellRateNumerator: number;
  sellRateDenominator: number;
  effectiveAt: number;
  createdBy: number;
  createdAt: number;
}

export interface FxSessionBalanceRecord {
  id: number;
  sessionId: number;
  shopId: number;
  currencyCode: string;
  openingBalance: number;
  expectedBalance: number | null;
  countedBalance: number | null;
  difference: number | null;
}

export interface FxSessionRecord {
  id: number;
  shopId: number;
  openedBy: number;
  closedBy: number | null;
  openedAt: number;
  closedAt: number | null;
  status: 'open' | 'closed';
  closingNote: string | null;
  totalMarginFcfa: number;
  operationCount: number;
  balances: FxSessionBalanceRecord[];
}

export interface FxOperationRecord {
  id: number;
  shopId: number;
  sessionId: number;
  operationType: 'buy' | 'sell' | 'adjustment';
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
  toAmount: number;
  rateSnapshotId: number | null;
  marginFcfa: number;
  note: string | null;
  createdBy: number;
  createdAt: number;
}

export interface FxMovementRecord {
  id: number;
  shopId: number;
  sessionId: number;
  currencyCode: string;
  movementType: 'deposit' | 'withdrawal' | 'adjustment';
  amount: number;
  note: string | null;
  createdBy: number;
  createdAt: number;
}

export interface OpenFxSessionData {
  openedBy: number;
  openingBalances: Array<{ currencyCode: string; amount: number }>;
}

export interface CloseFxSessionData {
  closedBy: number;
  closingNote: string | null;
  countedBalances: Array<{ currencyCode: string; amount: number }>;
}

export interface CreateFxRateData {
  quoteCurrency: string;
  buyRateNumerator: number;
  buyRateDenominator: number;
  sellRateNumerator: number;
  sellRateDenominator: number;
  createdBy: number;
}

export interface CreateFxOperationData {
  operationType: 'buy' | 'sell';
  fromCurrency: string;
  fromAmount: number;
  toCurrency: string;
  toAmount: number;
  note: string | null;
  createdBy: number;
  allowNegativeBalance: boolean;
}

export interface CreateFxMovementData {
  currencyCode: string;
  movementType: 'deposit' | 'withdrawal' | 'adjustment';
  amount: number;
  note: string | null;
  createdBy: number;
  allowNegativeBalance: boolean;
}

export interface UpsertShopCurrencyData {
  currencyCode: string;
  enabled: boolean;
  sortOrder: number;
}

export abstract class FxExchangeRepository {
  abstract findModuleStatus(
    shopId: number,
    moduleCode: string,
  ): Promise<FxModuleStatus | null>;

  abstract toggleModule(
    shopId: number,
    moduleCode: string,
    enabled: boolean,
  ): Promise<FxModuleStatus>;

  abstract assertModuleEnabled(shopId: number): Promise<void>;

  abstract listCurrencies(): Promise<FxCurrencyRecord[]>;

  abstract listShopCurrencies(shopId: number): Promise<FxShopCurrencyRecord[]>;

  abstract upsertShopCurrencies(
    shopId: number,
    items: UpsertShopCurrencyData[],
  ): Promise<FxShopCurrencyRecord[]>;

  abstract createRateSnapshot(
    shopId: number,
    data: CreateFxRateData,
  ): Promise<FxRateSnapshotRecord>;

  abstract listRateSnapshots(
    shopId: number,
    quoteCurrency?: string,
    limit?: number,
  ): Promise<FxRateSnapshotRecord[]>;

  abstract findLatestRatesForShop(
    shopId: number,
  ): Promise<FxRateSnapshotRecord[]>;

  abstract listSessions(shopId: number, limit?: number): Promise<FxSessionRecord[]>;

  abstract findOpenSession(shopId: number): Promise<FxSessionRecord | null>;

  abstract findSessionById(
    shopId: number,
    sessionId: number,
  ): Promise<FxSessionRecord | null>;

  abstract openSession(
    shopId: number,
    data: OpenFxSessionData,
  ): Promise<FxSessionRecord>;

  abstract closeSession(
    shopId: number,
    sessionId: number,
    data: CloseFxSessionData,
  ): Promise<FxSessionRecord>;

  abstract createOperation(
    shopId: number,
    sessionId: number,
    data: CreateFxOperationData,
  ): Promise<FxOperationRecord>;

  abstract listOperations(
    shopId: number,
    sessionId?: number,
    limit?: number,
  ): Promise<FxOperationRecord[]>;

  abstract createMovement(
    shopId: number,
    sessionId: number,
    data: CreateFxMovementData,
  ): Promise<FxMovementRecord>;

  abstract listMovements(
    shopId: number,
    sessionId?: number,
    limit?: number,
  ): Promise<FxMovementRecord[]>;

  abstract computeLiveBalances(
    shopId: number,
    sessionId: number,
  ): Promise<Map<string, number>>;
}
