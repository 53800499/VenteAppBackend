import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PinHasherService } from '../../../../core/security/pin-hasher.service';
import { nowMs } from '../../../../shared/utils/time.util';
import {
  formatPhoneE164,
  maskPhone,
  normalizePhoneToWhatsApp,
} from '../../../../shared/utils/phone.util';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { OtpChallengeRepository } from '../../domain/repositories/otp-challenge.repository';
import { MembershipResolverService } from '../../domain/services/membership-resolver.service';
import { AuthTokenService } from '../../domain/services/auth-token.service';
import { WhatsappOtpGateway } from '../../infrastructure/services/whatsapp-otp.gateway';
import { AuthPresenter } from '../../presentation/presenters/auth.presenter';

function generateOtpCode(length: number): string {
  const max = 10 ** length;
  const value = Math.floor(Math.random() * max);
  return value.toString().padStart(length, '0');
}

@Injectable()
export class RequestWhatsappOtpUseCase {
  constructor(
    private readonly otpRepository: OtpChallengeRepository,
    private readonly membershipResolver: MembershipResolverService,
    private readonly whatsapp: WhatsappOtpGateway,
    private readonly pinHasher: PinHasherService,
    private readonly configService: ConfigService,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  async execute(rawPhone: string) {
    const phone = normalizePhoneToWhatsApp(rawPhone);
    const memberships = await this.membershipResolver.resolveByPhone(phone);
    if (memberships.length === 0) {
      throw new NotFoundException(
        'Aucun compte associé à ce numéro. Demandez à votre patron d\'enregistrer votre WhatsApp.',
      );
    }

    const now = nowMs();
    const cooldown = this.configService.get<number>('auth.otpResendCooldownMs', 60_000);
    const lastCreated = await this.tenantDb.runWithoutTenant(() =>
      this.otpRepository.findLastCreatedAt(phone),
    );
    if (lastCreated != null && now - lastCreated < cooldown) {
      const waitSeconds = Math.ceil((cooldown - (now - lastCreated)) / 1000);
      throw new BadRequestException(
        `Patientez ${waitSeconds}s avant de demander un nouveau code.`,
      );
    }

    const otpLength = this.configService.get<number>('auth.otpLength', 6);
    const otpTtlMs = this.configService.get<number>('auth.otpTtlMs', 300_000);
    const code = generateOtpCode(otpLength);
    const codeHash = await this.pinHasher.hash(code);

    await this.tenantDb.runWithoutTenant(() =>
      this.otpRepository.create({
        phone,
        codeHash,
        expiresAt: now + otpTtlMs,
        createdAt: now,
      }),
    );

    await this.whatsapp.sendOtpCode(phone, code);

    return {
      maskedPhone: maskPhone(phone),
      expiresInSeconds: Math.floor(otpTtlMs / 1000),
      message: `Code envoyé sur WhatsApp au ${maskPhone(phone)}.`,
      phoneE164: formatPhoneE164(phone),
    };
  }
}

interface OtpVerificationPayload {
  purpose: 'whatsapp_otp';
  phone: string;
}

@Injectable()
export class VerifyWhatsappOtpUseCase {
  constructor(
    private readonly otpRepository: OtpChallengeRepository,
    private readonly membershipResolver: MembershipResolverService,
    private readonly pinHasher: PinHasherService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  async execute(rawPhone: string, code: string) {
    const phone = normalizePhoneToWhatsApp(rawPhone);
    const now = nowMs();
    const challenge = await this.tenantDb.runWithoutTenant(() =>
      this.otpRepository.findLatestActive(phone, now),
    );

    if (!challenge) {
      throw new UnauthorizedException('Code expiré ou introuvable. Demandez un nouveau code.');
    }

    const maxAttempts = this.configService.get<number>('auth.otpMaxAttempts', 5);
    if (challenge.attempts >= maxAttempts) {
      throw new UnauthorizedException('Trop de tentatives. Demandez un nouveau code.');
    }

    const valid = await this.pinHasher.compare(code, challenge.codeHash);
    if (!valid) {
      await this.tenantDb.runWithoutTenant(() =>
        this.otpRepository.incrementAttempts(challenge.id, challenge.attempts + 1),
      );
      throw new UnauthorizedException('Code incorrect.');
    }

    await this.tenantDb.runWithoutTenant(() =>
      this.otpRepository.markConsumed(challenge.id, now),
    );

    const memberships = await this.membershipResolver.resolveByPhone(phone);
    if (memberships.length === 0) {
      throw new NotFoundException('Aucun accès boutique pour ce numéro.');
    }

    const ttl = this.configService.get<number>('auth.otpVerificationJwtTtlSeconds', 300);
    const verificationToken = await this.jwtService.signAsync(
      { purpose: 'whatsapp_otp', phone } satisfies OtpVerificationPayload,
      { expiresIn: ttl },
    );

    return { verificationToken, memberships };
  }
}

@Injectable()
export class CompleteWhatsappOtpLoginUseCase {
  constructor(
    private readonly jwtService: JwtService,
    private readonly users: UserRepository,
    private readonly shops: ShopRepository,
    private readonly settings: SettingsRepository,
    private readonly authTokenService: AuthTokenService,
    private readonly presenter: AuthPresenter,
    private readonly tenantDb: TenantDatabaseService,
    private readonly membershipResolver: MembershipResolverService,
  ) {}

  async execute(input: {
    verificationToken: string;
    shopId: number;
    userId: number;
    deviceId: string;
    deviceLabel?: string;
  }) {
    let payload: OtpVerificationPayload;
    try {
      payload = await this.jwtService.verifyAsync<OtpVerificationPayload>(
        input.verificationToken,
      );
    } catch {
      throw new UnauthorizedException('Session OTP expirée. Recommencez la connexion.');
    }

    if (payload.purpose !== 'whatsapp_otp' || !payload.phone) {
      throw new UnauthorizedException('Jeton OTP invalide.');
    }

    const memberships = await this.membershipResolver.resolveByPhone(payload.phone);
    const selected = memberships.find(
      (m) => m.userId === input.userId && m.shopId === input.shopId,
    );
    if (!selected) {
      throw new ForbiddenException('Boutique non autorisée pour ce numéro.');
    }

    return this.tenantDb.runWithTenant(input.shopId, async () => {
      const user = await this.users.findByIdAndShop(input.userId, input.shopId);
      if (!user?.isActive) {
        throw new NotFoundException('Utilisateur introuvable.');
      }

      const shop = await this.shops.findShopById(input.shopId);
      if (!shop?.isActive) {
        throw new NotFoundException('Boutique inactive.');
      }

      const shopSettings =
        (await this.settings.findByShopId(input.shopId)) ??
        this.settings.getDefault(input.shopId);

      const loginAt = nowMs();
      await this.users.updateInShop(user.id, input.shopId, {
        last_login_at: loginAt,
        updated_at: loginAt,
        version: user.version + 1,
      });

      const activeUser = { ...user, lastLoginAt: loginAt };
      const { session, tokens } = await this.authTokenService.bootstrapSession(
        activeUser,
        input.shopId,
        shopSettings,
        {
          deviceId: input.deviceId,
          deviceLabel: input.deviceLabel,
        },
      );

      return this.presenter.presentLoginSuccess({
        session,
        user: activeUser,
        settings: shopSettings,
        shopId: input.shopId,
        shopName: shop.name,
        tokens,
      });
    });
  }
}
