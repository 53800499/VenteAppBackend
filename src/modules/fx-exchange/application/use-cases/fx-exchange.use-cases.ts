import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Permission } from '../../../../shared/enums/permission.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { FxCalculationService } from '../../domain/services/fx-calculation.service';
import { FxExchangeRepository } from '../../domain/repositories/fx-exchange.repository';
import {
  CloseFxSessionDto,
  CreateFxMovementDto,
  CreateFxOperationDto,
  CreateFxRateDto,
  ListFxOperationsQueryDto,
  ListFxRateHistoryQueryDto,
  OpenFxSessionDto,
  PreviewFxOperationDto,
  UpsertShopCurrenciesDto,
} from '../dto/fx-exchange.dto';

const MODULE_CODE = 'FX_EXCHANGE';
const BASE_CURRENCY = 'XOF';

@Injectable()
export class FxExchangeGuardService {
  constructor(private readonly repo: FxExchangeRepository) {}

  async assertEnabled(shopId: number): Promise<void> {
    await this.repo.assertModuleEnabled(shopId);
  }

  canAdjust(auth: AuthContext): boolean {
    return auth.permissions.includes(Permission.FX_EXCHANGE_ADJUST);
  }
}

@Injectable()
export class GetFxModuleStatusUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext) {
    return this.repo.findModuleStatus(auth.shopId, MODULE_CODE).then(
      (status) => ({ enabled: status?.enabled ?? false }),
    );
  }
}

@Injectable()
export class ToggleFxModuleUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext, enabled: boolean) {
    return this.repo.toggleModule(auth.shopId, MODULE_CODE, enabled);
  }
}

@Injectable()
export class ListFxCurrenciesUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  async execute(auth: AuthContext) {
    await this.repo.assertModuleEnabled(auth.shopId);
    const [catalog, shopCurrencies] = await Promise.all([
      this.repo.listCurrencies(),
      this.repo.listShopCurrencies(auth.shopId),
    ]);
    return { catalog, shopCurrencies };
  }
}

@Injectable()
export class UpsertFxShopCurrenciesUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext, dto: UpsertShopCurrenciesDto) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.upsertShopCurrencies(
        auth.shopId,
        dto.currencies.map((c) => ({
          currencyCode: c.currencyCode,
          enabled: c.enabled,
          sortOrder: c.sortOrder,
        })),
      ),
    );
  }
}

@Injectable()
export class CreateFxRateUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext, dto: CreateFxRateDto) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.createRateSnapshot(auth.shopId, {
        quoteCurrency: dto.quoteCurrency,
        buyRateNumerator: dto.buyRateNumerator,
        buyRateDenominator: dto.buyRateDenominator,
        sellRateNumerator: dto.sellRateNumerator,
        sellRateDenominator: dto.sellRateDenominator,
        createdBy: auth.userId,
        applyMode: dto.applyMode ?? 'next_session',
      }),
    );
  }
}

@Injectable()
export class ListFxRatesUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.findLatestRatesForShop(auth.shopId),
    );
  }
}

@Injectable()
export class ListFxRateHistoryUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext, query: ListFxRateHistoryQueryDto) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.listRateSnapshots(
        auth.shopId,
        query.quoteCurrency,
        query.limit ?? 100,
      ),
    );
  }
}

@Injectable()
export class ListFxSessionsUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.listSessions(auth.shopId),
    );
  }
}

@Injectable()
export class GetOpenFxSessionUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  async execute(auth: AuthContext) {
    await this.repo.assertModuleEnabled(auth.shopId);
    const session = await this.repo.findOpenSession(auth.shopId);
    if (!session) return { session: null, liveBalances: {} };

    const live = await this.repo.computeLiveBalances(auth.shopId, session.id);
    return {
      session,
      liveBalances: Object.fromEntries(live.entries()),
    };
  }
}

@Injectable()
export class OpenFxSessionUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext, dto: OpenFxSessionDto) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.openSession(auth.shopId, {
        openedBy: auth.userId,
        openingBalances: dto.openingBalances.map((b) => ({
          currencyCode: b.currencyCode,
          amount: b.amount,
        })),
      }),
    );
  }
}

@Injectable()
export class CloseFxSessionUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext, sessionId: number, dto: CloseFxSessionDto) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.closeSession(auth.shopId, sessionId, {
        closedBy: auth.userId,
        closingNote: dto.closingNote ?? null,
        countedBalances: dto.countedBalances.map((b) => ({
          currencyCode: b.currencyCode,
          amount: b.amount,
        })),
      }),
    );
  }
}

@Injectable()
export class ConfirmFxSessionCloseUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext, sessionId: number) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.confirmCloseSession(auth.shopId, sessionId, auth.userId),
    );
  }
}

@Injectable()
export class CancelFxPendingCloseUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext, sessionId: number) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.cancelPendingClose(auth.shopId, sessionId),
    );
  }
}

@Injectable()
export class CreateFxOperationUseCase {
  constructor(
    private readonly repo: FxExchangeRepository,
    private readonly guard: FxExchangeGuardService,
  ) {}

  execute(auth: AuthContext, sessionId: number, dto: CreateFxOperationDto) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.createOperation(auth.shopId, sessionId, {
        operationType: dto.operationType,
        fromCurrency: dto.fromCurrency,
        fromAmount: dto.fromAmount,
        toCurrency: dto.toCurrency,
        toAmount: dto.toAmount,
        customerId: dto.customerId ?? null,
        note: dto.note ?? null,
        createdBy: auth.userId,
        allowNegativeBalance: this.guard.canAdjust(auth),
      }),
    );
  }
}

@Injectable()
export class PreviewFxOperationUseCase {
  constructor(
    private readonly repo: FxExchangeRepository,
    private readonly calc: FxCalculationService,
  ) {}

  async execute(auth: AuthContext, dto: PreviewFxOperationDto) {
    await this.repo.assertModuleEnabled(auth.shopId);

    const quoteCurrency =
      dto.fromCurrency === BASE_CURRENCY
        ? dto.toCurrency
        : dto.fromCurrency;

    const open = await this.repo.findOpenSession(auth.shopId);
    const rate = open
      ? await this.repo.findSessionRate(auth.shopId, open.id, quoteCurrency)
      : (await this.repo.findLatestRatesForShop(auth.shopId)).find(
          (r) => r.quoteCurrency === quoteCurrency,
        ) ?? null;
    if (!rate) {
      throw new BadRequestException(
        open
          ? `Aucun taux de session pour ${quoteCurrency}.`
          : `Aucun taux défini pour ${quoteCurrency}.`,
      );
    }

    let toAmount = 0;
    let marginFcfa = 0;

    if (dto.operationType === 'sell') {
      if (dto.fromCurrency !== BASE_CURRENCY) {
        throw new BadRequestException('Vente : le client doit apporter FCFA.');
      }
      toAmount = this.calc.computeForeignFromFcfa(dto.fromAmount, {
        numerator: rate.sellRateNumerator,
        denominator: rate.sellRateDenominator,
      });
      marginFcfa = this.calc.computeSellMarginFcfa(dto.fromAmount, toAmount, {
        numerator: rate.buyRateNumerator,
        denominator: rate.buyRateDenominator,
      });
    } else {
      if (dto.fromCurrency === BASE_CURRENCY) {
        throw new BadRequestException(
          'Achat : le client doit apporter une devise étrangère.',
        );
      }
      toAmount = this.calc.computeFcfaFromForeign(dto.fromAmount, {
        numerator: rate.buyRateNumerator,
        denominator: rate.buyRateDenominator,
      });
      marginFcfa = this.calc.computeBuyMarginFcfa(dto.fromAmount, toAmount, {
        numerator: rate.sellRateNumerator,
        denominator: rate.sellRateDenominator,
      });
    }

    return {
      toAmount,
      marginFcfa,
      rateSnapshotId: rate.id,
      appliedRate:
        dto.operationType === 'sell'
          ? {
              numerator: rate.sellRateNumerator,
              denominator: rate.sellRateDenominator,
            }
          : {
              numerator: rate.buyRateNumerator,
              denominator: rate.buyRateDenominator,
            },
    };
  }
}

@Injectable()
export class ListFxOperationsUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext, query: ListFxOperationsQueryDto) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.listOperations(auth.shopId, query.sessionId, query.limit ?? 200),
    );
  }
}

@Injectable()
export class CreateFxMovementUseCase {
  constructor(
    private readonly repo: FxExchangeRepository,
    private readonly guard: FxExchangeGuardService,
  ) {}

  execute(auth: AuthContext, sessionId: number, dto: CreateFxMovementDto) {
    if (
      dto.movementType === 'adjustment' &&
      !this.guard.canAdjust(auth)
    ) {
      throw new ForbiddenException(
        'Permission requise pour les ajustements FX.',
      );
    }

    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.createMovement(auth.shopId, sessionId, {
        currencyCode: dto.currencyCode,
        movementType: dto.movementType,
        amount: dto.amount,
        note: dto.note ?? null,
        createdBy: auth.userId,
        allowNegativeBalance: this.guard.canAdjust(auth),
      }),
    );
  }
}

@Injectable()
export class ListFxMovementsUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  execute(auth: AuthContext, query: ListFxOperationsQueryDto) {
    return this.repo.assertModuleEnabled(auth.shopId).then(() =>
      this.repo.listMovements(auth.shopId, query.sessionId, query.limit ?? 200),
    );
  }
}

@Injectable()
export class GetFxDailyReportUseCase {
  constructor(private readonly repo: FxExchangeRepository) {}

  async execute(auth: AuthContext, sessionId: number) {
    await this.repo.assertModuleEnabled(auth.shopId);
    const session = await this.repo.findSessionById(auth.shopId, sessionId);
    if (!session) {
      throw new BadRequestException('Session FX introuvable.');
    }

    const operations = await this.repo.listOperations(
      auth.shopId,
      sessionId,
      10_000,
    );
    const movements = await this.repo.listMovements(
      auth.shopId,
      sessionId,
      10_000,
    );
    const live =
      session.status === 'open'
        ? await this.repo.computeLiveBalances(auth.shopId, sessionId)
        : null;

    const volumeByCurrency = new Map<string, number>();
    for (const op of operations) {
      volumeByCurrency.set(
        op.fromCurrency,
        (volumeByCurrency.get(op.fromCurrency) ?? 0) + op.fromAmount,
      );
    }

    return {
      session,
      operations,
      movements,
      liveBalances: live ? Object.fromEntries(live.entries()) : null,
      volumeByCurrency: Object.fromEntries(volumeByCurrency.entries()),
    };
  }
}
