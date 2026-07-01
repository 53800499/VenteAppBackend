export class ShopConfiguration {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly shopName: string,
    public readonly shopPhone: string | null,
    public readonly shopAddress: string | null,
    public readonly shopLogoPath: string | null,
    public readonly currency: string,
    public readonly language: string,
    public readonly defaultAlertThreshold: number,
    public readonly autoLockMinutes: number,
    public readonly receiptFooter: string | null,
    public readonly backupLastAt: number | null,
    public readonly backupPath: string | null,
    public readonly cloudSyncEnabled: boolean,
    public readonly cloudLastSyncAt: number | null,
    public readonly updatedAt: number,
  ) {}
}
