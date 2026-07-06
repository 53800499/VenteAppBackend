import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ExpensePaymentMethod,
  ExpenseRepeatSchedule,
  ExpenseStatus,
} from '../entities/expense.entity';

const VALID_METHODS = new Set<ExpensePaymentMethod>([
  'cash',
  'mtn_momo',
  'moov_money',
  'card',
  'transfer',
  'check',
]);

const VALID_REPEAT = new Set<ExpenseRepeatSchedule>([
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly',
]);

const VALID_STATUS = new Set<ExpenseStatus>([
  'draft',
  'pending',
  'validated',
  'refused',
]);

@Injectable()
export class ExpenseValidationService {
  assertAmount(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Le montant doit être supérieur à 0.');
    }
  }

  assertTitle(title: string): string {
    const trimmed = title.trim();
    if (trimmed.length < 2) {
      throw new BadRequestException('Le titre doit contenir au moins 2 caractères.');
    }
    return trimmed;
  }

  assertCategoryName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new BadRequestException('Le nom de catégorie doit contenir au moins 2 caractères.');
    }
    return trimmed;
  }

  assertPaymentMethod(method: string): ExpensePaymentMethod {
    if (!VALID_METHODS.has(method as ExpensePaymentMethod)) {
      throw new BadRequestException('Moyen de paiement invalide.');
    }
    return method as ExpensePaymentMethod;
  }

  assertRepeatSchedule(value: string): ExpenseRepeatSchedule {
    if (!VALID_REPEAT.has(value as ExpenseRepeatSchedule)) {
      throw new BadRequestException('Récurrence invalide.');
    }
    return value as ExpenseRepeatSchedule;
  }

  assertStatus(value: string): ExpenseStatus {
    if (!VALID_STATUS.has(value as ExpenseStatus)) {
      throw new BadRequestException('Statut invalide.');
    }
    return value as ExpenseStatus;
  }
}
