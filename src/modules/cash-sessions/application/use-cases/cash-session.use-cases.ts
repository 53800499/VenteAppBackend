import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PinHasherService } from '../../../../core/security/pin-hasher.service';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { UserRepository } from '../../../users/domain/repositories/user.repository';
import { CashSessionRepository } from '../../domain/repositories/cash-session.repository';
import { CashSessionValidationService } from '../../domain/services/cash-session-validation.service';
import {
  CloseCashSessionDto,
  CreateCashMovementDto,
  ListCashMovementsQueryDto,
  ListCashSessionsQueryDto,
  OpenCashSessionDto,
} from '../dto/cash-session.dto';

@Injectable()
export class ListCashSessionsUseCase {
  constructor(private readonly sessions: CashSessionRepository) {}

  execute(auth: AuthContext, query: ListCashSessionsQueryDto) {
    return this.sessions.listByShop(auth.shopId, query.limit ?? 50);
  }
}

@Injectable()
export class ListCashMovementsUseCase {
  constructor(private readonly sessions: CashSessionRepository) {}

  execute(auth: AuthContext, query: ListCashMovementsQueryDto) {
    return this.sessions.listMovements(auth.shopId, query.limit ?? 200);
  }
}

@Injectable()
export class OpenCashSessionUseCase {
  constructor(
    private readonly sessions: CashSessionRepository,
    private readonly validation: CashSessionValidationService,
  ) {}

  execute(auth: AuthContext, dto: OpenCashSessionDto) {
    return this.sessions.openSession(auth.shopId, {
      openingCash: this.validation.assertNonNegativeAmount(
        'Fond espèces',
        dto.openingCash,
      ),
      openingMomo: this.validation.assertNonNegativeAmount(
        'Fond Mobile Money',
        dto.openingMomo ?? 0,
      ),
      openedBy: auth.userId,
    });
  }
}

@Injectable()
export class CreateCashMovementUseCase {
  constructor(
    private readonly sessions: CashSessionRepository,
    private readonly validation: CashSessionValidationService,
  ) {}

  execute(auth: AuthContext, sessionId: number, dto: CreateCashMovementDto) {
    return this.sessions.createMovement(auth.shopId, sessionId, {
      movementType: dto.movementType,
      registerType: dto.registerType,
      amount: this.validation.assertPositiveAmount('Montant', dto.amount),
      note: dto.note ?? null,
      createdBy: auth.userId,
    });
  }
}

@Injectable()
export class CloseCashSessionUseCase {
  constructor(
    private readonly sessions: CashSessionRepository,
    private readonly validation: CashSessionValidationService,
    private readonly users: UserRepository,
    private readonly pinHasher: PinHasherService,
  ) {}

  async execute(auth: AuthContext, sessionId: number, dto: CloseCashSessionDto) {
    if (auth.role !== UserRole.OWNER) {
      const pin = dto.ownerPin?.trim() ?? '';
      if (pin.length < 4) {
        throw new BadRequestException(
          'Le PIN du patron est requis pour clôturer la caisse.',
        );
      }
      const users = await this.users.findAllByShop(auth.shopId);
      const owner = users.find((u) => u.role === UserRole.OWNER && u.isActive);
      if (!owner) {
        throw new BadRequestException('Patron introuvable pour cette boutique.');
      }
      const valid = await this.pinHasher.compare(pin, owner.pinHash);
      if (!valid) {
        throw new UnauthorizedException('PIN du patron incorrect.');
      }
    }

    return this.sessions.closeSession(auth.shopId, sessionId, {
      countedCash: this.validation.assertNonNegativeAmount(
        'Montant compté espèces',
        dto.countedCash,
      ),
      countedMomo: this.validation.assertNonNegativeAmount(
        'Montant compté MoMo',
        dto.countedMomo,
      ),
      closingNote: dto.closingNote ?? null,
      salesCash: this.validation.assertNonNegativeAmount(
        'Ventes espèces',
        dto.salesCash,
      ),
      salesMomo: this.validation.assertNonNegativeAmount(
        'Ventes MoMo',
        dto.salesMomo,
      ),
      expensesCash: this.validation.assertNonNegativeAmount(
        'Dépenses espèces',
        dto.expensesCash,
      ),
      expensesMomo: this.validation.assertNonNegativeAmount(
        'Dépenses MoMo',
        dto.expensesMomo,
      ),
      depositsCash: this.validation.assertNonNegativeAmount(
        'Entrées espèces',
        dto.depositsCash,
      ),
      depositsMomo: this.validation.assertNonNegativeAmount(
        'Entrées MoMo',
        dto.depositsMomo,
      ),
      withdrawalsCash: this.validation.assertNonNegativeAmount(
        'Retraits espèces',
        dto.withdrawalsCash,
      ),
      withdrawalsMomo: this.validation.assertNonNegativeAmount(
        'Retraits MoMo',
        dto.withdrawalsMomo,
      ),
      saleCount: this.validation.assertNonNegativeAmount(
        'Nombre de ventes',
        dto.saleCount,
      ),
      closedBy: auth.userId,
    });
  }
}
