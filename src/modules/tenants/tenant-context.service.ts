import { Injectable, Scope } from '@nestjs/common';
import { TenantAccessDeniedException, TenantContextRequiredException } from './exceptions/tenant.exceptions';

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private shopId: number | null = null;

  setShopId(shopId: number): void {
    if (!Number.isInteger(shopId) || shopId <= 0) {
      throw new TenantContextRequiredException();
    }
    this.shopId = shopId;
  }

  clear(): void {
    this.shopId = null;
  }

  isSet(): boolean {
    return this.shopId !== null;
  }

  getShopId(): number | null {
    return this.shopId;
  }

  requireShopId(): number {
    if (this.shopId === null) {
      throw new TenantContextRequiredException();
    }
    return this.shopId;
  }

  resolveShopId(explicitShopId?: number): number {
    if (explicitShopId !== undefined) {
      return explicitShopId;
    }
    return this.requireShopId();
  }

  assertMatches(expectedShopId: number): void {
    const current = this.requireShopId();
    if (current !== expectedShopId) {
      throw new TenantAccessDeniedException(expectedShopId);
    }
  }
}
