export class Category {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly name: string,
    public readonly isActive: boolean,
    public readonly sortOrder: number,
    public readonly createdAt: number,
    public readonly updatedAt: number,
  ) {}
}
