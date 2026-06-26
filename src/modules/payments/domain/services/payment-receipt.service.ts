import { Injectable } from '@nestjs/common';
import { PaymentRepository } from '../repositories/payment.repository';

@Injectable()
export class PaymentReceiptService {
  constructor(private readonly payments: PaymentRepository) {}

  async generate(shopId: number, timestamp: number): Promise<string> {
    const date = new Date(timestamp);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const prefix = `PAY-${y}${m}${d}-`;

    const dayStart = Date.UTC(y, date.getUTCMonth(), date.getUTCDate());
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
    const count = await this.payments.countByShopOnDay(shopId, dayStart, dayEnd);
    const seq = String(count + 1).padStart(4, '0');
    return `${prefix}${seq}`;
  }
}
