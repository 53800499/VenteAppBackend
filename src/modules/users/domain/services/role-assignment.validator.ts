import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { RbacRepository } from '../../../rbac/domain/repositories/rbac.repository';

@Injectable()
export class RoleAssignmentValidator {
  constructor(private readonly rbac: RbacRepository) {}

  async assertAssignable(roleCode: string, shopId: number): Promise<void> {
    if (roleCode === UserRole.OWNER) {
      throw new BadRequestException('Le rôle patron ne peut pas être attribué.');
    }

    const role = await this.rbac.findRoleByCode(roleCode);
    if (!role || !role.isActive) {
      throw new BadRequestException('Rôle inconnu ou inactif.');
    }

    if (role.scope === 'shop' && role.shopId !== shopId) {
      throw new BadRequestException('Ce rôle n\'appartient pas à cette boutique.');
    }
  }
}
