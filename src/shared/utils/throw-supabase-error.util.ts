import { BadRequestException, ConflictException } from '@nestjs/common';
import { humanizePostgresError } from './postgres-error.util';

/** Lance une erreur HTTP lisible à partir d'une erreur Supabase/PostgREST. */
export function throwSupabaseError(error: {
  message: string;
  code?: string;
}): never {
  const friendly = humanizePostgresError(error.message, error.code);
  if (friendly) {
    throw new ConflictException(friendly);
  }
  throw new BadRequestException(error.message);
}
