import { UserRole } from '../../../../shared/enums/user-role.enum';
import {
  LastOwnerProtectionException,
  OwnerPromotionNotAllowedException,
  SelfRoleDemotionException,
} from '../../../../shared/exceptions/rbac.exceptions';
import { User } from '../../../users/domain/entities/user.entity';

export interface RoleChangeContext {
  actorUserId: number;
  target: User;
  newRole: UserRole;
  ownerCount: number;
}

export class RoleChangePolicy {
  static validate(ctx: RoleChangeContext): void {
    if (ctx.target.id === ctx.actorUserId && ctx.newRole !== UserRole.OWNER) {
      throw new SelfRoleDemotionException();
    }

    if (ctx.target.role === UserRole.OWNER && ctx.newRole !== UserRole.OWNER) {
      if (ctx.ownerCount <= 1) {
        throw new LastOwnerProtectionException('demote');
      }
    }

    if (ctx.newRole === UserRole.OWNER && ctx.target.role !== UserRole.OWNER) {
      throw new OwnerPromotionNotAllowedException();
    }
  }
}
