import { ConflictException, Injectable } from '@nestjs/common';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';
import { ShopRepository } from '../../../shops/domain/repositories/shop.repository';
import { SetupOwnerCommand } from '../commands/auth.commands';

export interface SetupFieldConflict {
  field: 'ownerName' | 'ownerPhone' | 'shopName' | 'shopPhone';
  message: string;
}

@Injectable()
export class ValidateSetupOwnerUseCase {
  constructor(
    private readonly shops: ShopRepository,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  async execute(command: SetupOwnerCommand) {
    return this.buildResult(await this.findShopNameConflict(command));
  }

  async executeFull(command: SetupOwnerCommand) {
    return this.buildResult(await this.findShopNameConflict(command));
  }

  async assertNoConflictsFull(command: SetupOwnerCommand): Promise<void> {
    const conflicts = await this.findShopNameConflict(command);
    if (conflicts.length === 0) return;

    const fields = Object.fromEntries(
      conflicts.map((c) => [c.field, c.message]),
    );

    throw new ConflictException({
      message: 'Ce nom de boutique est déjà utilisé. Modifiez-le ou connectez-vous avec WhatsApp.',
      fields,
      conflicts,
    });
  }

  private async findShopNameConflict(
    command: SetupOwnerCommand,
  ): Promise<SetupFieldConflict[]> {
    const shopName = command.shopName.trim();
    if (!shopName) return [];

    const existing = await this.tenantDb.runWithoutTenant(() =>
      this.shops.findByNameIgnoreCase(shopName),
    );

    if (!existing) return [];

    return [
      {
        field: 'shopName',
        message: `La boutique « ${existing.name} » existe déjà. Choisissez un autre nom ou connectez-vous avec WhatsApp.`,
      },
    ];
  }

  private buildResult(conflicts: SetupFieldConflict[]) {
    return {
      valid: conflicts.length === 0,
      conflicts,
      message:
        conflicts.length === 0
          ? 'Aucun conflit détecté.'
          : 'Ce nom de boutique est déjà utilisé. Modifiez-le ou connectez-vous avec WhatsApp.',
    };
  }
}
