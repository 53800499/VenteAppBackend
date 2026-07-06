export type CashSessionStatus = 'open' | 'closed';

export interface CashSession {
  id: number;
  shopId: number;
  openedBy: number;
  closedBy: number | null;
  openedAt: number;
  closedAt: number | null;
  openingCash: number;
  openingMomo: number;
  salesCash: number;
  salesMomo: number;
  expensesCash: number;
  expensesMomo: number;
  depositsCash: number;
  depositsMomo: number;
  withdrawalsCash: number;
  withdrawalsMomo: number;
  expectedCash: number | null;
  expectedMomo: number | null;
  countedCash: number | null;
  countedMomo: number | null;
  differenceCash: number | null;
  differenceMomo: number | null;
  saleCount: number;
  status: CashSessionStatus;
  closingNote: string | null;
  createdAt: number;
  updatedAt: number;
}
