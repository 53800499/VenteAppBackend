export class Shop {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly address: string | null,
    public readonly phone: string | null,
    public readonly ownerUserId: number | null,
    public readonly isActive: boolean,
    public readonly isDefault: boolean,
    public readonly createdAt: number,
  ) {}
}

export class ShopSettings {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly shopName: string,
    public readonly shopLogoPath: string | null,
    public readonly autoLockMinutes: number,
  ) {}
}
