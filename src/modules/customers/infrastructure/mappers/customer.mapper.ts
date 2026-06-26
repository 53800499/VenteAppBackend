import { Customer } from '../../domain/entities/customer.entity';
import { CustomerRow, CustomerStatsRow } from '../persistence/customer.row';

export class CustomerMapper {
  static toDomain(row: CustomerRow, stats?: CustomerStatsRow): Customer {
    return new Customer(
      row.id,
      row.shop_id,
      row.name,
      row.phone,
      row.note ?? null,
      row.is_archived,
      row.created_at,
      row.updated_at,
      stats ? Number(stats.balance_due) : 0,
      stats ? Number(stats.open_debts_count) : 0,
      stats ? Number(stats.purchase_count) : 0,
      stats ? Number(stats.total_purchases) : 0,
      stats?.last_activity_at ?? null,
    );
  }
}
