import { Injectable } from '@nestjs/common';
import { TenantDatabaseService } from '../../../tenants/tenant-database.service';
import { UserRepository } from '../../../users/domain/repositories/user.repository';

@Injectable()
export class CheckSetupAvailableUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  async execute() {
    const initialSetup = await this.tenantDb.runWithoutTenant(async () => {
      const count = await this.users.countAll();
      return count === 0;
    });

    return {
      available: true,
      initialSetup,
      message: initialSetup
        ? 'Installation initiale disponible.'
        : 'Création d\'une nouvelle boutique disponible.',
    };
  }
}
