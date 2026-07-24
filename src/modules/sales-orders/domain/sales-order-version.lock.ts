import { ConflictException } from '@nestjs/common';

/**
 * Optimistic lock SO : le client envoie la version locale post-bump.
 * Accepté si absente (rétrocompat), égale à la DB (idempotent),
 * ou égale à DB+1 (écriture offline fraîche).
 */
export function assertSalesOrderOptimisticVersion(
  dbVersion: number,
  clientVersion?: number,
): void {
  if (clientVersion == null) return;
  if (clientVersion === dbVersion || clientVersion === dbVersion + 1) {
    return;
  }
  throw new ConflictException(
    'Conflit de version : la commande a été modifiée sur un autre appareil.',
  );
}
