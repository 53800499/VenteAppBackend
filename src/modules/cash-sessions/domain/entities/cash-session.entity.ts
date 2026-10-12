export type CashSessionStatus =
  | 'open'
  | 'submitted'
  | 'review_required'
  | 'justified'
  | 'approved'
  | 'reopened'
  | 'closed';

export interface CashSession {
  id: number;
  shopId: number;
  openedBy: number;
  closedBy: number | null;
  openedAt: number;
  closedAt: number | null;
  submittedAt: number | null;
  submittedBy: number | null;
  approvedAt: number | null;
  approvedBy: number | null;
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
  justificationCategory: string | null;
  justificationNote: string | null;
  reviewNote: string | null;
  createdAt: number;
  updatedAt: number;
}
