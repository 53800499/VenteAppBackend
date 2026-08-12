import { ConflictException, Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

export interface IdempotencyCheckInput {
  idempotencyKey: string;
  scope: string;
  shopId: number;
  userId?: number;
  payload: any;
}

export interface IdempotencyCheckResult {
  isCached: boolean;
  recordId?: string;
  statusCode?: number;
  responseBody?: any;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Calcule le hash SHA-256 déterministe d'un objet payload JSON.
   */
  public computePayloadHash(payload: any): string {
    const rawString = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  /**
   * Vérifie la présence d'une clé d'idempotence et enregistre le verrou atomique en BDD.
   */
  async checkOrLockKey(input: IdempotencyCheckInput): Promise<IdempotencyCheckResult> {
    const db = this.supabase.db;
    const currentHash = this.computePayloadHash(input.payload);
    const scope = input.scope || 'GLOBAL';

    try {
      // 1. Rechercher si la clé existe déjà dans idempotency_records
      const { data: existing, error: searchError } = await db
        .from('idempotency_records')
        .select('id, request_hash, status, response_status, response_body')
        .eq('shop_id', input.shopId)
        .eq('scope', scope)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle();

      if (searchError && searchError.code !== 'PGRST116') {
        this.logger.warn(`Erreur lecture idempotency_records: ${searchError.message}`);
      }

      if (existing) {
        // 2. Détection de réutilisation avec payload altéré
        if (existing.request_hash !== currentHash) {
          this.logger.error(
            `Conflit Idempotence : Clé ${input.idempotencyKey} réutilisée avec un payload différent pour la boutique #${input.shopId}`,
          );
          throw new ConflictException(
            'Clé d\'idempotence réutilisée avec des données différentes (IDEMPOTENCY_KEY_REUSED).',
          );
        }

        // 3. Si l'opération est déjà complétée, renvoyer la réponse sauvegardée
        if (existing.status === 'COMPLETED') {
          this.logger.log(
            `IdempotenceHIT : Réponse sauvegardée retournée pour la clé ${input.idempotencyKey} (Scope: ${scope})`,
          );
          return {
            isCached: true,
            statusCode: existing.response_status || 200,
            responseBody: existing.response_body,
          };
        }

        // 4. Si l'opération est en cours de traitement concurrent
        if (existing.status === 'PROCESSING') {
          throw new ConflictException(
            'Une opération identique avec cette clé d\'idempotence est actuellement en cours de traitement.',
          );
        }
      }

      // 5. Verrouillage atomique : Insertion au statut PROCESSING
      const { data: inserted, error: insertError } = await db
        .from('idempotency_records')
        .insert({
          idempotency_key: input.idempotencyKey,
          scope: scope,
          shop_id: input.shopId,
          user_id: input.userId || null,
          request_hash: currentHash,
          status: 'PROCESSING',
        })
        .select('id')
        .single();

      if (insertError) {
        // Si une contrainte d'unicité est violée à la volée (race condition)
        if (insertError.code === '23505') {
          throw new ConflictException(
            'Conflit d\'accès concurrent sur la clé d\'idempotence. Veuillez réessayer.',
          );
        }
        this.logger.error(`Échec verrouillage idempotency_records: ${insertError.message}`);
      }

      return {
        isCached: false,
        recordId: inserted?.id,
      };
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      // En cas d'erreur de la BDD d'idempotence, poursuivre l'exécution normale sans bloquer
      this.logger.warn(`IdempotencyService fallback mode (erreur BDD): ${err}`);
      return { isCached: false };
    }
  }

  /**
   * Enregistre le résultat de l'exécution et passe le statut à COMPLETED.
   */
  async saveSuccessResponse(recordId: string | undefined, statusCode: number, responseBody: any): Promise<void> {
    if (!recordId) return;
    const db = this.supabase.db;

    try {
      await db
        .from('idempotency_records')
        .update({
          status: 'COMPLETED',
          response_status: statusCode,
          response_body: responseBody ?? {},
        })
        .eq('id', recordId);
    } catch (err: any) {
      this.logger.error(`Échec mise à jour idempotency_records (${recordId}): ${err.message}`);
    }
  }

  /**
   * Libère le verrou d'idempotence au statut FAILED en cas d'échec d'exécution métier.
   */
  async markFailed(recordId: string | undefined): Promise<void> {
    if (!recordId) return;
    const db = this.supabase.db;

    try {
      await db
        .from('idempotency_records')
        .delete()
        .eq('id', recordId);
    } catch (err: any) {
      this.logger.error(`Échec suppression verrou idempotency_records (${recordId}): ${err.message}`);
    }
  }
}
