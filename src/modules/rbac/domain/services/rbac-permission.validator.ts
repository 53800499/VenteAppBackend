import { Injectable } from '@nestjs/common';
import { InvalidPermissionCodeException } from '../../../../shared/exceptions/rbac.exceptions';
import { RolePermissionGrant } from '../../domain/entities/rbac.entity';
import { RbacRepository } from '../../domain/repositories/rbac.repository';

@Injectable()
export class RbacPermissionValidator {
  constructor(private readonly rbac: RbacRepository) {}

  async validateGrants(grants: RolePermissionGrant[]): Promise<void> {
    const codes = grants.map((g) => g.permissionCode);
    if (codes.length === 0) return;
    const valid = await this.rbac.findPermissionCodes(codes);
    const invalid = codes.filter((c) => !valid.includes(c));
    if (invalid.length > 0) throw new InvalidPermissionCodeException(invalid);
  }

  async validateCode(permissionCode: string): Promise<void> {
    await this.validateGrants([{ permissionCode, effect: 'allow' }]);
  }
}
