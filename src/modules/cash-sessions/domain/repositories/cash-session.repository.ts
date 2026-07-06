import { CashSession } from '../entities/cash-session.entity';

export interface CashMovementRecord {
  id: number;
  shopId: number;
  sessionId: number;
  movementType: 'deposit' | 'withdrawal';
  registerType: string;
  amount: number;
  note: string | null;
  createdBy: number;
  createdAt: number;
}

export interface OpenCashSessionData {
  openingCash: number;
  openingMomo: number;
  openedBy: number;
}

export interface CloseCashSessionData {
  countedCash: number;
  countedMomo: number;
  closingNote?: string | null;
  salesCash: number;
  salesMomo: number;
  expensesCash: number;
  expensesMomo: number;
  depositsCash: number;
  depositsMomo: number;
  withdrawalsCash: number;
  withdrawalsMomo: number;
  saleCount: number;
  closedBy: number;
}

export interface CreateCashMovementData {
  movementType: 'deposit' | 'withdrawal';
  registerType: string;
  amount: number;
  note?: string | null;
  createdBy: number;
}

export abstract class CashSessionRepository {
  abstract listByShop(shopId: number, limit?: number): Promise<CashSession[]>;
  abstract findOpenByShop(shopId: number): Promise<CashSession | null>;
  abstract findByIdAndShop(id: number, shopId: number): Promise<CashSession | null>;
  abstract openSession(shopId: number, data: OpenCashSessionData): Promise<CashSession>;
  abstract closeSession(
    shopId: number,
    sessionId: number,
    data: CloseCashSessionData,
  ): Promise<CashSession>;
  abstract listMovements(shopId: number, limit?: number): Promise<CashMovementRecord[]>;
  abstract createMovement(
    shopId: number,
    sessionId: number,
    data: CreateCashMovementData,
  ): Promise<CashMovementRecord>;
}
