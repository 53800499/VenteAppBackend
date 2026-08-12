import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_SCOPE_KEY = 'idempotent_scope';

/**
 * Décorateur pour spécifier le périmètre métier (scope) d'une opération idempotente.
 * Exemples: `@IdempotentScope('SALES:create')`, `@IdempotentScope('CASH:movement')`
 */
export const IdempotentScope = (scope: String) => SetMetadata(IDEMPOTENT_SCOPE_KEY, scope);
