import { Sale, SaleItem } from '../../domain/entities/sale.entity';
import { SaleItemRow, SaleRow } from '../persistence/sale.row';

export class SaleMapper {
  static toDomain(row: SaleRow, items: SaleItemRow[] = []): Sale {
    return new Sale(
      row.id,
      row.shop_id,
      row.receipt_number ?? row.reference ?? `REC-${row.id}`,
      row.customer_id,
      row.user_id,
      row.sale_type ?? 'standard',
      row.subtotal ?? row.total_amount,
      row.discount_amount ?? 0,
      row.total_amount,
      row.amount_paid ?? row.amount_cash + row.amount_momo,
      row.amount_cash,
      row.amount_momo,
      row.amount_credit,
      row.payment_method ?? 'cash',
      row.status,
      row.cancel_reason,
      row.cancelled_by_user_id,
      row.cancelled_at,
      row.note,
      row.created_at,
      row.updated_at ?? row.created_at,
      row.version,
      items.map(SaleMapper.toItem),
    );
  }

  static toItem(row: SaleItemRow): SaleItem {
    return new SaleItem(
      row.id,
      row.shop_id,
      row.sale_id,
      row.product_id,
      row.product_name,
      Number(row.quantity),
      row.unit_price,
      row.unit_cost,
      row.discount_amount ?? 0,
      row.line_total,
      row.created_at,
    );
  }
}
