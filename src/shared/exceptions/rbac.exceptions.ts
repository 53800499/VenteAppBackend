import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';
import { DomainException } from './domain.exception';
import { Permission } from '../enums/permission.enum';
import { UserRole } from '../enums/user-role.enum';

export class InsufficientPermissionException extends DomainException {
  constructor(required: Permission[], missing: Permission[], role: UserRole) {
    super(
      ErrorCode.RBAC_INSUFFICIENT_PERMISSION,
      'Permissions insuffisantes pour cette action.',
      HttpStatus.FORBIDDEN,
      { required, missing, role },
      'Contactez le patron de la boutique pour obtenir les droits nécessaires.',
    );
  }
}

export class InsufficientRoleException extends DomainException {
  constructor(required: UserRole[], current: UserRole) {
    super(
      ErrorCode.RBAC_INSUFFICIENT_ROLE,
      'Rôle insuffisant pour cette action.',
      HttpStatus.FORBIDDEN,
      { required, current },
      'Cette action est réservée à un rôle spécifique.',
    );
  }
}

export class RoleNotFoundException extends DomainException {
  constructor(roleCode: string) {
    super(
      ErrorCode.RBAC_ROLE_NOT_FOUND,
      `Rôle « ${roleCode} » introuvable.`,
      HttpStatus.NOT_FOUND,
      { roleCode },
    );
  }
}

export class SystemRoleProtectedException extends DomainException {
  constructor(roleCode: string, action: string) {
    super(
      ErrorCode.RBAC_ROLE_SYSTEM_PROTECTED,
      `Le rôle système « ${roleCode} » ne peut pas être ${action}.`,
      HttpStatus.FORBIDDEN,
      { roleCode, action },
      'Les rôles système (patron, vendeur, lecteur) sont protégés.',
    );
  }
}

export class RoleCodeConflictException extends DomainException {
  constructor(code: string) {
    super(
      ErrorCode.RBAC_ROLE_CODE_CONFLICT,
      `Un rôle avec le code « ${code} » existe déjà.`,
      HttpStatus.CONFLICT,
      { code },
    );
  }
}

export class InvalidPermissionCodeException extends DomainException {
  constructor(codes: string[]) {
    super(
      ErrorCode.RBAC_INVALID_PERMISSION,
      'Une ou plusieurs permissions sont invalides ou inactives.',
      HttpStatus.BAD_REQUEST,
      { invalidCodes: codes },
    );
  }
}

export class OverrideNotFoundException extends DomainException {
  constructor(userId: number, permissionCode: string) {
    super(
      ErrorCode.RBAC_OVERRIDE_NOT_FOUND,
      'Override de permission introuvable.',
      HttpStatus.NOT_FOUND,
      { userId, permissionCode },
    );
  }
}

export class LastOwnerProtectionException extends DomainException {
  constructor(action: 'demote' | 'deactivate') {
    const verb = action === 'demote' ? 'rétrograder' : 'désactiver';
    super(
      ErrorCode.RBAC_LAST_OWNER_PROTECTED,
      `Impossible de ${verb} le dernier patron de la boutique.`,
      HttpStatus.FORBIDDEN,
      { action },
      'Promouvez un autre utilisateur en patron avant cette opération.',
    );
  }
}

export class SelfAccountDeactivationException extends DomainException {
  constructor() {
    super(
      ErrorCode.FORBIDDEN,
      'Vous ne pouvez pas désactiver votre propre compte.',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class SelfRoleDemotionException extends DomainException {
  constructor() {
    super(
      ErrorCode.RBAC_SELF_ROLE_DEMOTION,
      'Vous ne pouvez pas rétrograder votre propre rôle.',
      HttpStatus.FORBIDDEN,
      undefined,
      'Demandez à un autre patron d\'effectuer ce changement.',
    );
  }
}

export class OwnerPromotionNotAllowedException extends DomainException {
  constructor() {
    super(
      ErrorCode.RBAC_OWNER_PROMOTION_DENIED,
      'La promotion en patron n\'est pas autorisée via cette API.',
      HttpStatus.BAD_REQUEST,
      undefined,
      'Le transfert de propriété nécessite une procédure dédiée.',
    );
  }
}
