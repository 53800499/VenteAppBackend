import { Injectable } from '@nestjs/common';
import { SaleRepository } from '../repositories/sale.repository';

@Injectable()
export class ReceiptNumberService {
  constructor(private readonly sales: SaleRepository) {}

  async generate(shopId: number, timestamp: number): Promise<string> {
    const date = new Date(timestamp);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const dayStart = Date.UTC(y, date.getUTCMonth(), date.getUTCDate());
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;
    const count = await this.sales.countByShopOnDay(shopId, dayStart, dayEnd);
    const seq = String(count + 1).padStart(4, '0');
    return `REC-${y}${m}${d}-${seq}`;
  }
}
