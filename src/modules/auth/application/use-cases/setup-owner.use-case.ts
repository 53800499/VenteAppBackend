import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RecoveryTokenService } from '../../../../core/security/recovery-token.service';
import { PinHasherService } from '../../../../core/security/pin-hasher.service';
import { AUTH_EVENTS, SetupCompletedEvent } from '../../../../core/events/auth.events';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';
import { normalizePhoneToWhatsApp } from '../../../../shared/utils/phone.util';
import { nowMs } from '../../../../shared/utils/time.util';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { Pin } from '../../domain/value-objects/pin.vo';
import { SetupOwnerCommand } from '../commands/auth.commands';
import { ValidateSetupOwnerUseCase } from './validate-setup-owner.use-case';
import { IdentityProvisioningService } from '../../../identity/domain/services/identity-provisioning.service';

@Injectable()
export class SetupOwnerUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly shops: ShopRepository,
    private readonly settings: SettingsRepository,
    private readonly pinHasher: PinHasherService,
    private readonly recoveryToken: RecoveryTokenService,
    private readonly configService: ConfigService,
    private readonly events: EventEmitter2,
    private readonly tenantDb: TenantDatabaseService,
    private readonly validateSetup: ValidateSetupOwnerUseCase,
    private readonly identityProvisioning: IdentityProvisioningService,
  ) {}

  async execute(command: SetupOwnerCommand) {
    await this.validateSetup.assertNoConflictsFull(command);

    return this.tenantDb.runWithoutTenant(async () => {
      const pin = Pin.create(command.pin);
      const pinHash = await this.pinHasher.hash(pin.value);
      const { token: recoveryToken, hash: recoveryHashPromise } = this.recoveryToken.generate();
      const recoveryHash = await recoveryHashPromise;
      const timestamp = nowMs();
      const ownerPhone = normalizePhoneToWhatsApp(command.ownerPhone);

      const planCode = command.planCode || 'FREE';
      
      let trialEnabled = true;
      let trialDurationDays = 14;
      let gracePeriodDays = 7;

      try {
        const db = this.tenantDb.getAdminClient();
        const { data: policyData } = await db.from('platform_settings').select('licensing_policy_json').eq('id', 'default').maybeSingle();
        if (policyData && policyData.licensing_policy_json) {
          const p = policyData.licensing_policy_json;
          if (p.trialEnabled === false) trialEnabled = false;
          if (p.trialDurationDays) trialDurationDays = Number(p.trialDurationDays);
          if (p.gracePeriodDays) gracePeriodDays = Number(p.gracePeriodDays);
        }
      } catch {}

      const isFree = planCode === 'FREE';
      const subStatus = isFree ? 'ACTIVE' : (trialEnabled ? 'TRIAL' : 'PENDING_ACTIVATION');
      const trialExpiresAt = isFree
        ? new Date(Date.now() + 3650 * 86400000).toISOString() // 10 ans pour le forfait permanent gratuit
        : (trialEnabled
            ? new Date(Date.now() + trialDurationDays * 86400000).toISOString()
            : new Date().toISOString());
      const trialGraceUntil = isFree
        ? new Date(Date.now() + 3660 * 86400000).toISOString()
        : (trialEnabled
            ? new Date(Date.now() + (trialDurationDays + gracePeriodDays) * 86400000).toISOString()
            : new Date().toISOString());

      const shop = await this.shops.create({
        name: command.shopName,
        address: command.shopAddress ?? null,
        phone: command.shopPhone ?? null,
        is_active: true,
        is_default: true,
        created_at: timestamp,
      });

      const user = await this.users.create({
        shop_id: shop.id,
        name: command.ownerName,
        phone: ownerPhone,
        pin_hash: pinHash,
        role: UserRole.OWNER,
        emergency_recovery_hash: recoveryHash,
        created_at: timestamp,
        updated_at: timestamp,
      });

      await this.shops.updateOwner(shop.id, user.id);

      await this.settings.create({
        shop_id: shop.id,
        shop_name: command.shopName,
        shop_phone: command.shopPhone ?? null,
        shop_address: command.shopAddress ?? null,
        auto_lock_minutes: this.configService.get<number>('auth.defaultAutoLockMinutes', 5),
        updated_at: timestamp,
      });

      this.events.emit(AUTH_EVENTS.SETUP_COMPLETED, new SetupCompletedEvent(user.id, shop.id));

      const provisionResult = await this.identityProvisioning.provisionNewOwnerShop({
        phone: ownerPhone,
        displayName: command.ownerName,
        userId: user.id,
        shopId: shop.id,
        shopName: shop.name,
      });

      // Initialize Subscription & Plan (TRIAL or PENDING_ACTIVATION based on policy)
      try {
        const db = this.tenantDb.getAdminClient();
        const { data: shopRecord } = await db.from('shops').select('server_id').eq('id', shop.id).maybeSingle();
        const tenantUuid = shopRecord?.server_id;

        const { data: planData } = await db.from('subscription_plans').select('id').eq('code', planCode).maybeSingle();
        if (planData?.id && tenantUuid) {
          await db.from('subscriptions').insert({
            tenant_id: tenantUuid,
            plan_id: planData.id,
            plan_code: planCode,
            status: subStatus,
            started_at: new Date().toISOString(),
            expires_at: trialExpiresAt,
            grace_until: trialGraceUntil,
            auto_renew: false,
          });
        }
      } catch {
        // Fallback gracefully
      }

      return {
        shopId: shop.id,
        userId: user.id,
        recoveryToken,
        planCode,
        message:
          'Boutique créée avec succès. Sauvegardez le fichier de récupération d\'urgence en lieu sûr.',
      };
    });
  }
}
