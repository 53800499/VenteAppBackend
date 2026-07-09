import { TenantModule, CalculatorProductData, CalculatorHistory } from '../entities/calculators.entity';

export abstract class CalculatorsRepository {
  abstract findModuleStatus(shopId: number, moduleCode: string): Promise<TenantModule | null>;
  abstract toggleModule(shopId: number, moduleCode: string, enabled: boolean): Promise<TenantModule>;
  abstract listProductData(shopId: number): Promise<CalculatorProductData[]>;
  abstract upsertProductData(
    shopId: number,
    productId: number,
    type: string,
    metadata: Record<string, any>,
  ): Promise<CalculatorProductData>;
  abstract listHistory(shopId: number): Promise<CalculatorHistory[]>;
  abstract createHistory(
    shopId: number,
    data: {
      calculatorType: string;
      input: Record<string, any>;
      result: Record<string, any>;
      isFavorite?: boolean;
      label?: string | null;
      createdBy: number;
    },
  ): Promise<CalculatorHistory>;
}
