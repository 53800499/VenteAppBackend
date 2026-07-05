import { SalesAnalysisAggregationService } from './sales-analysis-aggregation.service';
import { SalesAnalysisItemRow, SalesAnalysisSaleRow } from '../entities/sales-analysis.entity';

describe('SalesAnalysisAggregationService', () => {
  let service: SalesAnalysisAggregationService;

  beforeEach(() => {
    service = new SalesAnalysisAggregationService();
  });

  const sampleItems: SalesAnalysisItemRow[] = [
    {
      saleId: 1,
      soldAt: 1_700_000_000_000,
      userId: 1,
      sellerName: 'Alice',
      productId: 10,
      productName: 'Eau',
      quantity: 2,
      unitPrice: 500,
      lineTotal: 1000,
      discountAmount: 0,
      unitCost: 300,
      catalogPrice: 500,
      priceBuy: 300,
      categoryId: 1,
      categoryName: 'Boissons',
    },
    {
      saleId: 2,
      soldAt: 1_700_086_400_000,
      userId: 2,
      sellerName: 'Bob',
      productId: 11,
      productName: 'Jus',
      quantity: 1,
      unitPrice: 400,
      lineTotal: 400,
      discountAmount: 50,
      unitCost: null,
      catalogPrice: 500,
      priceBuy: 250,
      categoryId: 1,
      categoryName: 'Boissons',
    },
  ];

  it('agrège les ventes par catégorie', () => {
    const categories = service.aggregateCategories(sampleItems);
    expect(categories).toHaveLength(1);
    expect(categories[0].categoryName).toBe('Boissons');
    expect(categories[0].productCount).toBe(2);
    expect(categories[0].revenue).toBe(1400);
  });

  it('calcule les marges avec coût unitaire ou prix d\'achat', () => {
    const margins = service.aggregateMargins(sampleItems);
    expect(margins.totalRevenue).toBe(1400);
    expect(margins.totalCost).toBe(850);
    expect(margins.estimatedProfit).toBe(550);
    expect(margins.linesWithCost).toBe(2);
  });

  it('détecte les écarts de prix', () => {
    const deviations = service.aggregatePriceDeviations(sampleItems);
    expect(deviations).toHaveLength(1);
    expect(deviations[0].productName).toBe('Jus');
    expect(deviations[0].unitPrice).toBe(400);
  });

  it('agrège les tendances journalières', () => {
    const sales: SalesAnalysisSaleRow[] = [
      { id: 1, totalAmount: 1000, createdAt: 1_700_000_000_000 },
      { id: 2, totalAmount: 400, createdAt: 1_700_086_400_000 },
    ];
    const trends = service.aggregateTrends(sales, sampleItems);
    expect(trends.totalRevenue).toBe(1400);
    expect(trends.totalSaleCount).toBe(2);
    expect(trends.points.length).toBeGreaterThanOrEqual(1);
  });
});
