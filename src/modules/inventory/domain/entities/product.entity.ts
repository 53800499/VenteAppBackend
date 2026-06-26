export class Product {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly categoryId: number | null,
    public readonly name: string,
    public readonly sku: string | null,
    public readonly quantityInStock: number,
    public readonly alertThreshold: number | null,
    public readonly priceBuy: number | null,
    public readonly priceSell: number,
    public readonly isArchived: boolean,
    public readonly createdAt: number,
    public readonly updatedAt: number,
    public readonly version: number,
  ) {}
}
