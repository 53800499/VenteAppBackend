export class AuditLogEntry {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly userId: number,
    public readonly userName: string | null,
    public readonly action: string,
    public readonly module: string,
    public readonly entityId: number,
    public readonly entityTable: string,
    public readonly oldValue: Record<string, unknown> | null,
    public readonly newValue: Record<string, unknown> | null,
    public readonly reason: string | null,
    public readonly createdAt: number,
  ) {}
}
