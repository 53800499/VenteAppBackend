import { CashSession } from '../entities/cash-session.entity';

export type CashMovementType = 'deposit' | 'withdrawal' | 'owner_drop' | 'bank_deposit';

export interface CashMovementRecord {
  id: number;
  shopId: number;
  sessionId: number;
  movementType: CashMovementType;
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
  justificationCategory?: string | null;
  justificationNote?: string | null;
}

export interface SubmitCashSessionClosingData {
  countedCash: number;
  countedMomo: number;
  salesCash: number;
  salesMomo: number;
  expensesCash: number;
  expensesMomo: number;
  depositsCash: number;
  depositsMomo: number;
  withdrawalsCash: number;
  withdrawalsMomo: number;
  saleCount: number;
  submittedBy: number;
  closingNote?: string | null;
  justificationCategory?: string | null;
  justificationNote?: string | null;
}

export interface ApproveCashSessionClosingData {
  approvedBy: number;
  reviewNote?: string | null;
}

export interface ReopenCashSessionData {
  reopenedBy: number;
  reason: string;
}

export interface CreateCashMovementData {
  movementType: CashMovementType;
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
  abstract submitClosing(
    shopId: number,
    sessionId: number,
    data: SubmitCashSessionClosingData,
  ): Promise<CashSession>;
  abstract approveClosing(
    shopId: number,
    sessionId: number,
    data: ApproveCashSessionClosingData,
  ): Promise<CashSession>;
  abstract reopenSession(
    shopId: number,
    sessionId: number,
    data: ReopenCashSessionData,
  ): Promise<CashSession>;
  abstract listMovements(shopId: number, limit?: number): Promise<CashMovementRecord[]>;
  abstract createMovement(
    shopId: number,
    sessionId: number,
    data: CreateCashMovementData,
  ): Promise<CashMovementRecord>;
}
