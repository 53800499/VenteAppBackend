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
  ) {}

  async execute(command: SetupOwnerCommand) {
    return this.tenantDb.runWithoutTenant(async () => {
      const pin = Pin.create(command.pin);
      const pinHash = await this.pinHasher.hash(pin.value);
      const { token: recoveryToken, hash: recoveryHashPromise } = this.recoveryToken.generate();
      const recoveryHash = await recoveryHashPromise;
      const timestamp = nowMs();
      const ownerPhone = normalizePhoneToWhatsApp(command.ownerPhone);

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

      return {
        shopId: shop.id,
        userId: user.id,
        recoveryToken,
        message:
          'Boutique créée avec succès. Sauvegardez le fichier de récupération d\'urgence en lieu sûr.',
      };
    });
  }
}
