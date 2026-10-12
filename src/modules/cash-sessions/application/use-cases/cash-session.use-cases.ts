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
  ApproveCashSessionDto,
  CloseCashSessionDto,
  CreateCashMovementDto,
  ListCashMovementsQueryDto,
  ListCashSessionsQueryDto,
  OpenCashSessionDto,
  OwnerDropCashDto,
  ReopenCashSessionDto,
  SubmitCashSessionClosingDto,
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
export class RecordOwnerDropUseCase {
  constructor(
    private readonly sessions: CashSessionRepository,
    private readonly validation: CashSessionValidationService,
  ) {}

  async execute(auth: AuthContext, sessionId: number, dto: OwnerDropCashDto) {
    const amount = this.validation.assertPositiveAmount(
      'Montant de la remise de fonds',
      dto.amount,
    );
    return this.sessions.createMovement(auth.shopId, sessionId, {
      movementType: 'owner_drop',
      registerType: dto.registerType || 'cash',
      amount,
      note: dto.note ?? 'Remise de fonds au propriétaire',
      createdBy: auth.userId,
    });
  }
}

@Injectable()
export class SubmitCashSessionClosingUseCase {
  constructor(
    private readonly sessions: CashSessionRepository,
    private readonly validation: CashSessionValidationService,
  ) {}

  async execute(
    auth: AuthContext,
    sessionId: number,
    dto: SubmitCashSessionClosingDto,
  ) {
    return this.sessions.submitClosing(auth.shopId, sessionId, {
      countedCash: this.validation.assertNonNegativeAmount(
        'Montant compté espèces',
        dto.countedCash,
      ),
      countedMomo: this.validation.assertNonNegativeAmount(
        'Montant compté MoMo',
        dto.countedMomo,
      ),
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
      closingNote: dto.closingNote ?? null,
      justificationCategory: dto.justificationCategory ?? null,
      justificationNote: dto.justificationNote ?? null,
      submittedBy: auth.userId,
    });
  }
}

@Injectable()
export class ApproveCashSessionUseCase {
  constructor(private readonly sessions: CashSessionRepository) {}

  async execute(
    auth: AuthContext,
    sessionId: number,
    dto: ApproveCashSessionDto,
  ) {
    return this.sessions.approveClosing(auth.shopId, sessionId, {
      approvedBy: auth.userId,
      reviewNote: dto.reviewNote ?? null,
    });
  }
}

@Injectable()
export class ReopenCashSessionUseCase {
  constructor(private readonly sessions: CashSessionRepository) {}

  async execute(
    auth: AuthContext,
    sessionId: number,
    dto: ReopenCashSessionDto,
  ) {
    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new BadRequestException(
        'Un motif de réouverture de 5 caractères minimum est requis.',
      );
    }
    return this.sessions.reopenSession(auth.shopId, sessionId, {
      reopenedBy: auth.userId,
      reason: dto.reason.trim(),
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
          'Le PIN du patron est requis pour clôturer la caisse directement.',
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
      justificationCategory: dto.justificationCategory ?? null,
      justificationNote: dto.justificationNote ?? null,
    });
  }
}
