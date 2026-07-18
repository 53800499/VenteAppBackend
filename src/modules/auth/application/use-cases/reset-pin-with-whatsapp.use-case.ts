import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PinHasherService } from '../../../../core/security/pin-hasher.service';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';
import { MembershipResolverService } from '../../domain/services/membership-resolver.service';
import { Pin } from '../../domain/value-objects/pin.vo';

interface OtpVerificationPayload {
  purpose: 'whatsapp_otp';
  phone: string;
}

@Injectable()
export class ResetPinWithWhatsappOtpUseCase {
  constructor(
    private readonly jwtService: JwtService,
    private readonly users: UserRepository,
    private readonly pinHasher: PinHasherService,
    private readonly membershipResolver: MembershipResolverService,
    private readonly logAudit: LogAuditUseCase,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  async execute(input: {
    verificationToken: string;
    shopId: number;
    userId: number;
    newPin: string;
  }) {
    let payload: OtpVerificationPayload;
    try {
      payload = await this.jwtService.verifyAsync<OtpVerificationPayload>(
        input.verificationToken,
      );
    } catch {
      throw new UnauthorizedException(
        'Session OTP expirée. Recommencez la récupération.',
      );
    }

    if (payload.purpose !== 'whatsapp_otp' || !payload.phone) {
      throw new UnauthorizedException('Jeton OTP invalide.');
    }

    const memberships = await this.membershipResolver.resolveByPhone(payload.phone);
    const selected = this.membershipResolver.findMatchingMembership(
      memberships,
      input.userId,
      input.shopId,
    );
    if (!selected) {
      throw new ForbiddenException('Boutique non autorisée pour ce numéro.');
    }

    const pin = Pin.create(input.newPin);
    const pinHash = await this.pinHasher.hash(pin.value);
    const timestamp = nowMs();

    return this.tenantDb.runWithTenant(input.shopId, async () => {
      const user = await this.users.findByIdAndShop(input.userId, input.shopId);
      if (!user?.isActive) {
        throw new NotFoundException('Utilisateur introuvable.');
      }

      await this.users.updateInShop(user.id, input.shopId, {
        pin_hash: pinHash,
        failed_attempts: 0,
        locked_until: null,
        lockout_count: 0,
        updated_at: timestamp,
        version: user.version + 1,
      });

      await this.logAudit.execute({
        shopId: input.shopId,
        userId: user.id,
        action: AuditAction.SETTINGS_UPDATED,
        module: AuditModule.AUTH,
        entityId: user.id,
        entityTable: 'users',
        reason: 'Réinitialisation PIN via OTP WhatsApp',
      });

      return {
        message: 'Nouveau code PIN enregistré.',
      };
    });
  }
}
