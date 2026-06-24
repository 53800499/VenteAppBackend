export class AuditLog {
  constructor(
    public readonly shopId: number,
    public readonly userId: number,
    public readonly action: string,
    public readonly module: string,
    public readonly entityId: number,
    public readonly entityTable: string,
    public readonly oldValue: Record<string, unknown> | null,
    public readonly newValue: Record<string, unknown> | null,
    public readonly reason: string | null,
  ) {}
}
