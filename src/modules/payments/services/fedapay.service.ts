import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service';
import { PlanModulesGuard } from '../../../shared/guards/plan-modules.guard';

export interface CreateFedaPayTransactionDto {
  amount: number;
  description: string;
  phoneNumber?: string;
  mode?: string; // 'mtn', 'moov', 'celtiis', 'card'
  shopId: number;
  planCode?: string;
  durationDays?: number;
  addonCode?: string;
  callbackUrl?: string;
}

@Injectable()
export class FedaPayService {
  private readonly logger = new Logger(FedaPayService.name);
  private readonly processingTxIds = new Set<string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  private getEnv(key: string): string {
    const raw = this.configService.get<string>(key) ?? process.env[key] ?? '';
    return raw.trim().replace(/^["']|["']$/g, '').trim();
  }

  private get secretKey(): string {
    return this.getEnv('FEDAPAY_SECRET_KEY');
  }

  private get environment(): string {
    const env = this.getEnv('FEDAPAY_ENVIRONMENT');
    if (env) return env.toLowerCase();
    if (this.secretKey.startsWith('sk_sandbox_')) return 'sandbox';
    if (this.secretKey.startsWith('sk_live_')) return 'live';
    return 'live';
  }

  private get baseUrl(): string {
    if (this.secretKey.startsWith('sk_live_')) return 'https://api.fedapay.com/v1';
    if (this.secretKey.startsWith('sk_sandbox_')) return 'https://sandbox-api.fedapay.com/v1';

    return this.environment === 'live'
      ? 'https://api.fedapay.com/v1'
      : 'https://sandbox-api.fedapay.com/v1';
  }

  getHealthStatus() {
    const key = this.secretKey;
    let keyType = 'missing';
    if (key.includes('changez_moi')) {
      keyType = 'placeholder';
    } else if (key.startsWith('sk_live_')) {
      keyType = 'sk_live';
    } else if (key.startsWith('sk_sandbox_')) {
      keyType = 'sk_sandbox';
    } else if (key.startsWith('pk_')) {
      keyType = 'pk_wrong_key';
    } else if (key.length > 0) {
      keyType = 'unknown_format';
    }

    return {
      configured: Boolean(key) && !key.includes('changez_moi') && key.startsWith('sk_'),
      environment: this.environment,
      baseUrl: this.baseUrl,
      keyType,
      hasWebhookSecret: Boolean(this.getEnv('FEDAPAY_WEBHOOK_SECRET')),
      hasCallbackUrl: Boolean(this.getEnv('FEDAPAY_CALLBACK_URL')),
    };
  }

  /**
   * Créer une transaction FedaPay
   */
  async createTransaction(dto: CreateFedaPayTransactionDto) {
    if (!this.secretKey || this.secretKey.includes('changez_moi')) {
      this.logger.error('FedaPay FEDAPAY_SECRET_KEY absente ou non configurée dans le fichier .env.');
      return {
        success: false,
        message: 'Clé FedaPay non configurée sur le serveur. Veuillez renseigner FEDAPAY_SECRET_KEY dans le fichier .env.',
      };
    }

    const url = `${this.baseUrl}/transactions`;

    let phoneObj: any = undefined;
    if (dto.phoneNumber) {
      const cleanPhone = dto.phoneNumber.replace(/\D/g, '');
      // Au Bénin (229), les numéros passent à 10 chiffres (ex: 01XXXXXXXX).
      // On retire l'indicatif pays 229 sans tronquer les 10 chiffres locaux.
      const localNum =
        cleanPhone.startsWith('229') && cleanPhone.length >= 11
          ? cleanPhone.slice(3)
          : cleanPhone;
      if (localNum.length >= 8) {
        phoneObj = {
          number: localNum,
          country: 'BJ',
        };
      }
    }

    const callbackUrl = dto.callbackUrl || this.configService.get<string>('FEDAPAY_CALLBACK_URL');

    const payload: Record<string, any> = {
      amount: Math.round(dto.amount),
      currency: { iso: 'XOF' },
      description: dto.description,
      ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      custom_metadata: {
        shop_id: dto.shopId,
        plan_code: dto.planCode,
        duration_days: dto.durationDays || 30,
        addon_code: dto.addonCode,
      },
      customer: {
        firstname: 'Boutique',
        lastname: `#${dto.shopId}`,
        email: `shop_${dto.shopId}@arike.app`,
        ...(phoneObj ? { phone_number: phoneObj } : {}),
      },
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.secretKey}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        this.logger.error(`FedaPay error: ${JSON.stringify(data)}`);
        const msg = data.message || 'Erreur FedaPay';
        if (msg.toLowerCase().includes('auth') || res.status === 401) {
          throw new Error('Erreur d\'authentification FedaPay. Vérifiez la clé FEDAPAY_SECRET_KEY et le mode (sandbox/live) dans .env.');
        }
        throw new Error(msg);
      }

      const transaction = data['v1/transaction'] || data.v1?.transaction || data.transaction || data;
      const transactionId = transaction.id;

      let token = transaction.payment_token;
      let checkoutUrl = transaction.payment_url;

      // Si le token n'est pas fourni directement dans la transaction, le générer
      if (!token || !checkoutUrl) {
        try {
          const tokenResult = await this.generateToken(transactionId, dto.mode);
          token = token || tokenResult.token;
          checkoutUrl = checkoutUrl || tokenResult.url;
        } catch (_) {}
      }

      return {
        success: true,
        transactionId: transactionId,
        token: token,
        checkoutUrl: checkoutUrl,
        message: 'Transaction FedaPay créée avec succès',
      };
    } catch (err: any) {
      this.logger.error(`FedaPay Exception: ${err.message}`);
      return {
        success: false,
        message: err.message || 'Échec de communication avec FedaPay',
      };
    }
  }

  /**
   * Générer le token de paiement FedaPay
   */
  private async generateToken(transactionId: number, mode?: string) {
    const url = `${this.baseUrl}/transactions/${transactionId}/token`;
    const body: any = {};
    if (mode) body.mode = mode;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.secretKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      this.logger.error(`FedaPay generateToken error: ${JSON.stringify(data)}`);
      throw new Error(data.message || 'Erreur lors de la génération du token FedaPay');
    }
    const result = data['v1/token'] || data.v1 || data;
    return {
      token: result.token || data.token,
      url: result.url || data.url,
    };
  }

  /**
   * Vérifier l'état d'une transaction FedaPay directement auprès de l'API FedaPay
   */
  async checkStatus(transactionId: number) {
    try {
      const url = `${this.baseUrl}/transactions/${transactionId}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        return {
          success: false,
          status: 'unknown',
          message: data?.message || 'Erreur lors de la vérification FedaPay',
        };
      }

      const tx = data['v1/transaction'] || data.v1?.transaction || data.transaction || data;
      let status = tx.status;

      // Auto-approbation UNIQUEMENT en mode Sandbox explicite avec clé sk_sandbox_
      if (
        this.environment === 'sandbox' &&
        this.secretKey.startsWith('sk_sandbox_') &&
        status === 'pending'
      ) {
        status = 'approved';
        tx.status = 'approved';
      }

      if (status === 'approved' || status === 'transferred') {
        let metadata = tx.custom_metadata || tx.metadata || {};
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (_) {}
        }
        const shopId = metadata.shop_id || metadata.shopId;
        const planCode = metadata.plan_code || metadata.planCode;
        const durationDays = parseInt(metadata.duration_days || metadata.durationDays || '30', 10);
        const addonCode = metadata.addon_code || metadata.addonCode;

        if (shopId) {
          await this.applySubscriptionUpgrade(Number(shopId), planCode, durationDays, addonCode, tx);
        }
      }

      return {
        success: true,
        status: status, // 'approved', 'canceled', 'pending', 'declined'
        amount: tx.amount,
        approvedAt: tx.approved_at,
        metadata: tx.custom_metadata,
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'unknown',
        message: err.message,
      };
    }
  }

  /**
   * Vérifie la signature HMAC FedaPay si présente et si FEDAPAY_WEBHOOK_SECRET est configuré.
   */
  private verifyWebhookSignature(body: any, headers?: Record<string, string>): boolean {
    const webhookSecret = this.configService.get<string>('FEDAPAY_WEBHOOK_SECRET') || '';
    if (!webhookSecret || webhookSecret.includes('changez_moi')) {
      return true;
    }

    const normalizedHeaders: Record<string, string> = {};
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        normalizedHeaders[k.toLowerCase()] = String(v);
      }
    }

    const sigHeader = normalizedHeaders['x-fedapay-signature'];
    if (!sigHeader) {
      return false;
    }

    try {
      const parts = sigHeader.split(',').reduce<Record<string, string>>((acc, item) => {
        const [k, v] = item.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});

      const timestamp = parts['t'];
      const signature = parts['s'];
      if (!timestamp || !signature) return false;

      const payloadToSign = `${timestamp}.${typeof body === 'string' ? body : JSON.stringify(body)}`;
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadToSign)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expected, 'utf8');
      return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  /**
   * Traitement automatique et sécurisé du Webhook FedaPay.
   * Source de vérité : re-vérification directe auprès de l'API FedaPay + idempotence stricte.
   */
  async handleWebhook(body: any, headers?: Record<string, string>) {
    try {
      if (!body || typeof body !== 'object') {
        return { status: 'success', message: 'Payload vide ou invalide ignoré' };
      }

      const event = body.name || body.event || body.type || body.v1?.event || '';
      const entity =
        body['v1/transaction'] ||
        body.entity ||
        body.data?.object ||
        body.transaction ||
        body.v1?.transaction ||
        body;
      const rawStatus = entity?.status || body.status || '';
      const txId = entity?.id ? Number(entity.id) : null;

      this.logger.log(`FedaPay Webhook reçu: event=${event}, txId=${txId}, status=${rawStatus}`);

      if (
        rawStatus === 'approved' ||
        rawStatus === 'transferred' ||
        event === 'transaction.approved' ||
        event === 'approved'
      ) {
        const sigValid = this.verifyWebhookSignature(body, headers);

        // Sécurité en ligne : toujours confirmer l'état réel de la transaction chez FedaPay API
        // si l'ID de transaction est disponible (empêche toute usurpation de webhook).
        if (txId && this.secretKey && !this.secretKey.includes('changez_moi')) {
          const verified = await this.checkStatus(txId);
          if (!verified.success || (verified.status !== 'approved' && verified.status !== 'transferred')) {
            this.logger.warn(
              `Webhook FedaPay rejeté : transaction ${txId} non confirmée par l'API FedaPay (statut réel=${verified.status})`,
            );
            return { status: 'ignored', message: 'Transaction non approuvée côté FedaPay' };
          }
          return { status: 'success', message: 'Webhook FedaPay vérifié via API et traité' };
        }

        if (!sigValid) {
          this.logger.warn('Webhook FedaPay rejeté : signature HMAC invalide et aucun txId vérifiable');
          return { status: 'ignored', message: 'Signature webhook invalide' };
        }

        let metadata = entity?.custom_metadata || entity?.metadata || body?.custom_metadata || {};
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (_) {}
        }

        const shopId = metadata?.shop_id || metadata?.shopId;
        const planCode = metadata?.plan_code || metadata?.planCode;
        const durationDays = parseInt(metadata?.duration_days || metadata?.durationDays || '30', 10);
        const addonCode = metadata?.addon_code || metadata?.addonCode;

        if (shopId) {
          await this.applySubscriptionUpgrade(Number(shopId), planCode, durationDays, addonCode, entity);
        } else {
          this.logger.warn(`Webhook FedaPay approuvé mais shop_id manquant dans metadata: ${JSON.stringify(metadata)}`);
        }
      }

      return { status: 'success', message: 'Webhook FedaPay traité avec succès' };
    } catch (err: any) {
      this.logger.error(`Erreur lors du traitement du Webhook FedaPay: ${err.message}`, err.stack);
      // Toujours renvoyer un statut 200 à FedaPay pour éviter la désactivation de l'endpoint
      return { status: 'success', message: 'Erreur interne enregistrée', error: err.message };
    }
  }

  /**
   * Activation automatique et idempotente du forfait en base de données après paiement.
   */
  public async applySubscriptionUpgrade(
    shopId: number,
    planCode?: string,
    durationDays = 30,
    addonCode?: string,
    entity?: any,
  ) {
    const db = this.supabase.db;
    const now = new Date();
    const txId = entity?.id ? String(entity.id) : null;
    const paymentReference = txId ? `FEDAPAY-${txId}` : `FEDAPAY-${Date.now()}`;

    if (txId && this.processingTxIds.has(txId)) {
      this.logger.log(`Transaction FedaPay ${txId} déjà en cours de traitement — ignorée`);
      return;
    }

    if (txId) {
      this.processingTxIds.add(txId);
    }

    try {
      // 1. Idempotence stricte en base : vérifier si cette transaction FedaPay a déjà été appliquée
      if (txId) {
        const { data: alreadyApplied } = await db
          .from('subscriptions')
          .select('id')
          .eq('payment_reference', paymentReference)
          .limit(1)
          .maybeSingle();

        if (alreadyApplied) {
          this.logger.log(`Transaction FedaPay ${txId} déjà appliquée en base (id=${alreadyApplied.id}) — idempotence OK`);
          return;
        }
      }

      const { data: shop } = await db
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .maybeSingle();

      if (!shop) {
        this.logger.error(`Shop ${shopId} non trouvé pour mise à jour FedaPay`);
        return;
      }

      const tenantUuid = shop.server_id;
      if (!tenantUuid) {
        this.logger.error(`Shop ${shopId} n'a pas de server_id valide pour subscriptions`);
        return;
      }

      // 2. Vérifier la souscription existante pour cumul des jours restants
      const { data: existingSub } = await db
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenantUuid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentExpires = existingSub?.expires_at
        ? new Date(existingSub.expires_at).getTime()
        : now.getTime();
      const baseTime = currentExpires > now.getTime() ? currentExpires : now.getTime();
      const expiresAt = new Date(baseTime + durationDays * 86400000);
      const graceUntil = new Date(expiresAt.getTime() + 7 * 86400000);

      const targetPlan = planCode || existingSub?.plan_code || 'ESSENTIEL';
      const paidAmount = entity?.amount ? Number(entity.amount) : null;

      // 3. Enregistrer l'abonnement actif dans la table `subscriptions`
      const { data: planData } = await db
        .from('subscription_plans')
        .select('id, price_monthly')
        .eq('code', targetPlan)
        .maybeSingle();

      await db.from('subscriptions').insert({
        tenant_id: tenantUuid,
        plan_id: planData?.id,
        plan_code: targetPlan,
        status: 'ACTIVE',
        amount: paidAmount ?? (Number(planData?.price_monthly) || 0),
        currency: 'FCFA',
        payment_method: 'FedaPay',
        payment_reference: paymentReference,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        grace_until: graceUntil.toISOString(),
        auto_renew: false,
      });

      // 4. Mettre à jour la boutique et invalider le cache du guard immédiatement
      await db
        .from('shops')
        .update({
          plan: targetPlan,
          is_active: true,
          subscription_expires_at: expiresAt.toISOString(),
        })
        .eq('id', shopId);

      PlanModulesGuard.invalidateCache(shopId);

      this.logger.log(
        `Shop ${shopId} (tenant: ${tenantUuid}) abonnement activé via FedaPay (${paymentReference}): plan=${targetPlan}, expire=${expiresAt.toISOString()}`,
      );
    } catch (err: any) {
      this.logger.error(`Échec applySubscriptionUpgrade FedaPay pour shop ${shopId}: ${err.message}`);
    } finally {
      if (txId) {
        this.processingTxIds.delete(txId);
      }
    }
  }
}
