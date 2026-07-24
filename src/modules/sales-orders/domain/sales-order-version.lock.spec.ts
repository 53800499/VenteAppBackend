import { ConflictException } from '@nestjs/common';
import { assertSalesOrderOptimisticVersion } from './sales-order-version.lock';

describe('assertSalesOrderOptimisticVersion', () => {
  it('accepte version absente (rétrocompat)', () => {
    expect(() => assertSalesOrderOptimisticVersion(3)).not.toThrow();
  });

  it('accepte version égale (idempotent)', () => {
    expect(() => assertSalesOrderOptimisticVersion(3, 3)).not.toThrow();
  });

  it('accepte version DB+1 (écriture offline)', () => {
    expect(() => assertSalesOrderOptimisticVersion(3, 4)).not.toThrow();
  });

  it('rejette version trop ancienne ou trop en avance', () => {
    expect(() => assertSalesOrderOptimisticVersion(5, 3)).toThrow(
      ConflictException,
    );
    expect(() => assertSalesOrderOptimisticVersion(5, 8)).toThrow(
      ConflictException,
    );
  });
});
