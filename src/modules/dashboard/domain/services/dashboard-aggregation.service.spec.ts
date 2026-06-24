import { DashboardAggregationService } from './dashboard-aggregation.service';
import { TodaySaleRow } from '../entities/dashboard.entity';

describe('DashboardAggregationService', () => {
  let service: DashboardAggregationService;

  beforeEach(() => {
    service = new DashboardAggregationService();
  });

  it('retourne 0 FCFA si aucune vente (RG-DB-05)', () => {
    const stats = service.aggregateSales([]);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.saleCount).toBe(0);
  });

  it('agrège CA, cash, momo et crédit', () => {
    const sales: TodaySaleRow[] = [
      {
        id: 1,
        totalAmount: 10000,
        amountCash: 7000,
        amountMomo: 3000,
        amountCredit: 0,
        createdAt: 1,
        customerId: null,
        customerName: null,
      },
      {
        id: 2,
        totalAmount: 5000,
        amountCash: 0,
        amountMomo: 0,
        amountCredit: 5000,
        createdAt: 2,
        customerId: 1,
        customerName: 'Client',
      },
    ];
    const stats = service.aggregateSales(sales);
    expect(stats.totalRevenue).toBe(15000);
    expect(stats.saleCount).toBe(2);
    expect(stats.totalCredit).toBe(5000);
  });

  it('masque le bénéfice sans prix d\'achat (RG-DB-06)', () => {
    const stats = service.aggregateSales([]);
    const financial = service.aggregateFinancial(
      stats,
      [{ quantity: 2, unitPrice: 1000, unitCost: null }],
      { debtorCount: 0, totalDebt: 0 },
    );
    expect(financial.estimatedProfit).toBeNull();
    expect(financial.profitAvailable).toBe(false);
    expect(financial.profitWarning).toBeTruthy();
  });

  it('calcule le bénéfice estimé avec coûts', () => {
    const stats = service.aggregateSales([]);
    const financial = service.aggregateFinancial(
      stats,
      [
        { quantity: 2, unitPrice: 1000, unitCost: 600 },
        { quantity: 1, unitPrice: 500, unitCost: 200 },
      ],
      { debtorCount: 1, totalDebt: 3000 },
    );
    expect(financial.estimatedProfit).toBe(1100);
    expect(financial.profitAvailable).toBe(true);
    expect(financial.totalDebt).toBe(3000);
  });
});
