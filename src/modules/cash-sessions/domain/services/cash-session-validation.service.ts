import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class CashSessionValidationService {
  assertNonNegativeAmount(label: string, value: number): number {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${label} invalide.`);
    }
    return Math.trunc(value);
  }

  assertPositiveAmount(label: string, value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(`${label} doit être positif.`);
    }
    return Math.trunc(value);
  }

  computeExpectedCash(input: {
    openingCash: number;
    salesCash: number;
    depositsCash: number;
    expensesCash: number;
    withdrawalsCash: number;
  }): number {
    return (
      input.openingCash +
      input.salesCash +
      input.depositsCash -
      input.expensesCash -
      input.withdrawalsCash
    );
  }

  computeExpectedMomo(input: {
    openingMomo: number;
    salesMomo: number;
    depositsMomo: number;
    expensesMomo: number;
    withdrawalsMomo: number;
  }): number {
    return (
      input.openingMomo +
      input.salesMomo +
      input.depositsMomo -
      input.expensesMomo -
      input.withdrawalsMomo
    );
  }
}
