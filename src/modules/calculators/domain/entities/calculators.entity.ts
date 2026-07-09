export class TenantModule {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly moduleCode: string,
    public readonly enabled: boolean,
    public readonly createdAt: number,
  ) {}
}

export class CalculatorProductData {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly productId: number,
    public readonly calculatorType: string,
    public readonly metadata: Record<string, any>,
    public readonly version: number,
    public readonly serverId: string | null,
    public readonly syncStatus: string | null,
    public readonly createdAt: number,
    public readonly updatedAt: number,
  ) {}
}

export class CalculatorHistory {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly calculatorType: string,
    public readonly input: Record<string, any>,
    public readonly result: Record<string, any>,
    public readonly isFavorite: boolean,
    public readonly label: string | null,
    public readonly createdAt: number,
    public readonly createdBy: number,
    public readonly version: number,
    public readonly serverId: string | null,
    public readonly syncStatus: string | null,
  ) {}
}
