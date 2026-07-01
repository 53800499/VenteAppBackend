import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { nowMs } from '../../../../shared/utils/time.util';
import { LogAuditUseCase } from '../../../audit/application/use-cases/log-audit.use-case';
import { ShopConfiguration } from '../../../shops/domain/entities/shop-configuration.entity';
import { SettingsRepository } from '../../../shops/domain/repositories/settings.repository';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import {
  BACKUP_REMINDER_AGE_MS,
  SettingsValidationService,
} from '../../domain/services/settings-validation.service';
import { SettingsNotFoundException } from '../../exceptions/settings.exceptions';
import {
  RecordBackupDto,
  UpdateSettingsDto,
  UpdateSyncSettingsDto,
} from '../dto/settings.dto';

function toSettingsResponse(config: ShopConfiguration, now = nowMs()) {
  const backupOverdue =
    config.backupLastAt == null || now - config.backupLastAt >= BACKUP_REMINDER_AGE_MS;

  return {
    shop: {
      name: config.shopName,
      phone: config.shopPhone,
      address: config.shopAddress,
      logoPath: config.shopLogoPath,
    },
    localization: {
      currency: config.currency,
      language: config.language,
    },
    inventory: {
      defaultAlertThreshold: config.defaultAlertThreshold,
    },
    security: {
      autoLockMinutes: config.autoLockMinutes,
    },
    receipts: {
      footer: config.receiptFooter,
    },
    backup: {
      lastAt: config.backupLastAt,
      path: config.backupPath,
      reminderRecommended: backupOverdue,
    },
    sync: {
      enabled: config.cloudSyncEnabled,
      lastAt: config.cloudLastSyncAt,
    },
    updatedAt: config.updatedAt,
    notificationsEndpoint: '/api/notifications/settings',
  };
}

@Injectable()
export class GetSettingsUseCase {
  constructor(private readonly settings: SettingsRepository) {}

  async execute(auth: AuthContext) {
    const config = await this.settings.findConfigurationByShopId(auth.shopId);
    if (!config) {
      throw new SettingsNotFoundException();
    }
    return toSettingsResponse(config);
  }
}

@Injectable()
export class UpdateSettingsUseCase {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly shops: ShopRepository,
    private readonly validation: SettingsValidationService,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, dto: UpdateSettingsDto) {
    const existing = await this.settings.findConfigurationByShopId(auth.shopId);
    if (!existing) {
      throw new SettingsNotFoundException();
    }

    const payload: Record<string, unknown> = {};
    const timestamp = nowMs();

    if (dto.shopName !== undefined) {
      this.validation.assertShopName(dto.shopName);
      payload.shop_name = dto.shopName.trim();
    }
    if (dto.shopPhone !== undefined) payload.shop_phone = dto.shopPhone?.trim() || null;
    if (dto.shopAddress !== undefined) payload.shop_address = dto.shopAddress?.trim() || null;
    if (dto.shopLogoPath !== undefined) payload.shop_logo_path = dto.shopLogoPath;
    if (dto.defaultAlertThreshold !== undefined) {
      this.validation.assertDefaultAlertThreshold(dto.defaultAlertThreshold);
      payload.default_alert_threshold = dto.defaultAlertThreshold;
    }
    if (dto.autoLockMinutes !== undefined) {
      this.validation.assertAutoLockMinutes(dto.autoLockMinutes);
      payload.auto_lock_minutes = dto.autoLockMinutes;
    }
    if (dto.receiptFooter !== undefined) {
      this.validation.assertReceiptFooter(dto.receiptFooter);
      payload.receipt_footer = dto.receiptFooter?.trim() || null;
    }

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('Aucun paramètre à mettre à jour.');
    }

    payload.updated_at = timestamp;

    const updated = await this.settings.updateConfiguration(auth.shopId, payload as never);

    if (dto.shopName !== undefined || dto.shopPhone !== undefined || dto.shopAddress !== undefined) {
      await this.shops.updateInShop(auth.shopId, {
        ...(dto.shopName !== undefined ? { name: updated.shopName } : {}),
        ...(dto.shopPhone !== undefined ? { phone: updated.shopPhone } : {}),
        ...(dto.shopAddress !== undefined ? { address: updated.shopAddress } : {}),
      });
    }

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.SETTINGS_UPDATED,
      module: AuditModule.SETTINGS,
      entityId: updated.id,
      entityTable: 'settings',
      oldValue: {
        shopName: existing.shopName,
        autoLockMinutes: existing.autoLockMinutes,
        defaultAlertThreshold: existing.defaultAlertThreshold,
      },
      newValue: {
        shopName: updated.shopName,
        autoLockMinutes: updated.autoLockMinutes,
        defaultAlertThreshold: updated.defaultAlertThreshold,
      },
    });

    return toSettingsResponse(updated);
  }
}

@Injectable()
export class RecordBackupUseCase {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, dto: RecordBackupDto) {
    const existing = await this.settings.findConfigurationByShopId(auth.shopId);
    if (!existing) {
      throw new SettingsNotFoundException();
    }

    const recordedAt = nowMs();
    const updated = await this.settings.recordBackup(auth.shopId, {
      backup_last_at: recordedAt,
      backup_path: dto.path?.trim() || null,
      updated_at: recordedAt,
    });

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.BACKUP_RECORDED,
      module: AuditModule.SETTINGS,
      entityId: updated.id,
      entityTable: 'settings',
      newValue: { backupLastAt: recordedAt, backupPath: dto.path ?? null },
      reason: 'Sauvegarde manuelle enregistrée (RG-PARAM-04)',
    });

    const response = toSettingsResponse(updated, recordedAt);
    return {
      backup: response.backup,
      recordedAt,
    };
  }
}

@Injectable()
export class UpdateSyncSettingsUseCase {
  constructor(
    private readonly settings: SettingsRepository,
    private readonly logAudit: LogAuditUseCase,
  ) {}

  async execute(auth: AuthContext, dto: UpdateSyncSettingsDto) {
    const existing = await this.settings.findConfigurationByShopId(auth.shopId);
    if (!existing) {
      throw new SettingsNotFoundException();
    }

    const payload: Record<string, unknown> = { updated_at: nowMs() };
    if (dto.enabled !== undefined) payload.cloud_sync_enabled = dto.enabled;
    if (dto.lastSyncAt !== undefined) payload.cloud_last_sync_at = dto.lastSyncAt;

    if (Object.keys(payload).length === 1) {
      throw new BadRequestException('Aucun paramètre de synchronisation à mettre à jour.');
    }

    const updated = await this.settings.updateSyncSettings(auth.shopId, payload as never);

    await this.logAudit.execute({
      shopId: auth.shopId,
      userId: auth.userId,
      action: AuditAction.SYNC_SETTINGS_UPDATED,
      module: AuditModule.SETTINGS,
      entityId: updated.id,
      entityTable: 'settings',
      oldValue: {
        cloudSyncEnabled: existing.cloudSyncEnabled,
        cloudLastSyncAt: existing.cloudLastSyncAt,
      },
      newValue: {
        cloudSyncEnabled: updated.cloudSyncEnabled,
        cloudLastSyncAt: updated.cloudLastSyncAt,
      },
    });

    return { sync: toSettingsResponse(updated).sync };
  }
}
