import { UserRole } from '../../../../shared/enums/user-role.enum';

export class User {
  constructor(
    public readonly id: number,
    public readonly shopId: number,
    public readonly name: string,
    public readonly pinHash: string,
    public readonly role: UserRole,
    public readonly isActive: boolean,
    public readonly avatarPath: string | null,
    public readonly lastLoginAt: number | null,
    public readonly failedAttempts: number,
    public readonly lockedUntil: number | null,
    public readonly lockoutCount: number,
    public readonly emergencyRecoveryHash: string | null,
    public readonly biometricEnabled: boolean,
    public readonly createdAt: number,
    public readonly updatedAt: number,
    public readonly version: number,
  ) {}
}

export interface UserSummary {
  id: number;
  name: string;
  role: UserRole;
  biometricEnabled: boolean;
}
