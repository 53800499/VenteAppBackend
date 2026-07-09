import { Injectable } from '@nestjs/common';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { CalculatorsRepository } from '../../domain/repositories/calculators.repository';

@Injectable()
export class GetCalculatorsStatusUseCase {
  constructor(private readonly repo: CalculatorsRepository) {}

  async execute(auth: AuthContext) {
    const status = await this.repo.findModuleStatus(auth.shopId, 'CALCULATORS');
    return { enabled: status?.enabled ?? false };
  }
}

@Injectable()
export class ToggleCalculatorsUseCase {
  constructor(private readonly repo: CalculatorsRepository) {}

  async execute(auth: AuthContext, enabled: boolean) {
    const status = await this.repo.toggleModule(auth.shopId, 'CALCULATORS', enabled);
    return { enabled: status.enabled };
  }
}

@Injectable()
export class ListCalculatorProductsUseCase {
  constructor(private readonly repo: CalculatorsRepository) {}

  async execute(auth: AuthContext) {
    return this.repo.listProductData(auth.shopId);
  }
}

@Injectable()
export class UpsertCalculatorProductUseCase {
  constructor(private readonly repo: CalculatorsRepository) {}

  async execute(
    auth: AuthContext,
    productId: number,
    type: string,
    metadata: Record<string, any>,
  ) {
    return this.repo.upsertProductData(auth.shopId, productId, type, metadata);
  }
}

@Injectable()
export class ListCalculatorHistoryUseCase {
  constructor(private readonly repo: CalculatorsRepository) {}

  async execute(auth: AuthContext) {
    return this.repo.listHistory(auth.shopId);
  }
}

@Injectable()
export class CreateCalculatorHistoryUseCase {
  constructor(private readonly repo: CalculatorsRepository) {}

  async execute(
    auth: AuthContext,
    payload: {
      calculatorType: string;
      input: Record<string, any>;
      result: Record<string, any>;
      isFavorite?: boolean;
      label?: string | null;
    },
  ) {
    return this.repo.createHistory(auth.shopId, {
      ...payload,
      createdBy: auth.userId,
    });
  }
}
