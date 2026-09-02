import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../../infrastructure/supabase/supabase.service';

export interface CreateFedaPayTransactionDto {
  amount: number;
  description: string;
  phoneNumber?: string;
  mode?: string; // 'mtn', 'moov', 'celtiis', 'card'
  shopId: number;
  planCode?: string;
  durationDays?: number;
  addonCode?: string;
}

@Injectable()
export class FedaPayService {
  private readonly logger = new Logger(FedaPayService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  private get secretKey(): string {
    return this.configService.get<string>('FEDAPAY_SECRET_KEY') || '';
  }

  private get environment(): string {
    const env = this.configService.get<string>('FEDAPAY_ENVIRONMENT');
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
      const num = cleanPhone.length > 8 ? cleanPhone.slice(-8) : cleanPhone;
      phoneObj = {
        number: num,
        country: 'BJ',
      };
    }

    const payload = {
      amount: Math.round(dto.amount),
      currency: { iso: 'XOF' },
      description: dto.description,
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
   * Vérifier l'état d'une transaction FedaPay
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
      const tx = data['v1/transaction'] || data.v1?.transaction || data.transaction || data;
      let status = tx.status;

      // En mode Sandbox (environnement sandbox ou clé de test), auto-approuver
      // immédiatement les transactions de test en attente pour un flux de dev fluide.
      if ((this.environment === 'sandbox' || this.secretKey.includes('sandbox')) && status === 'pending') {
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
   * Traitement automatique du Webhook FedaPay
   */
  async handleWebhook(body: any, headers?: Record<string, string>) {
    try {
      this.logger.log(`FedaPay Webhook payload reçu: ${JSON.stringify(body)}`);

      if (!body || typeof body !== 'object') {
        return { status: 'success', message: 'Payload vide ou invalide ignoré' };
      }

      const event = body.name || body.event || body.type || body.v1?.event || '';
      const entity = body['v1/transaction'] || body.entity || body.data?.object || body.transaction || body.v1?.transaction || body;
      const status = entity?.status || body.status || '';

      this.logger.log(`FedaPay Webhook analysé: event=${event}, status=${status}`);

      if (
        status === 'approved' ||
        status === 'transferred' ||
        event === 'transaction.approved' ||
        event === 'approved'
      ) {
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
   * Activation automatique du forfait en base de données après paiement
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

    try {
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

      // Vérifier la souscription existante
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

      // Enregistrer l'abonnement actif dans la table `subscriptions`
      try {
        const { data: planData } = await db
          .from('subscription_plans')
          .select('id')
          .eq('code', targetPlan)
          .maybeSingle();

        await db.from('subscriptions').insert({
          tenant_id: tenantUuid,
          plan_id: planData?.id,
          plan_code: targetPlan,
          status: 'ACTIVE',
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          grace_until: graceUntil.toISOString(),
          auto_renew: false,
        });
      } catch (subErr: any) {
        this.logger.warn(`Insertion table subscriptions échouée: ${subErr.message}`);
      }

      this.logger.log(`Shop ${shopId} (tenant: ${tenantUuid}) abonnement activé avec succès via FedaPay: plan=${targetPlan}, expire=${expiresAt.toISOString()}`);
    } catch (err: any) {
      this.logger.error(`Échec applySubscriptionUpgrade FedaPay pour shop ${shopId}: ${err.message}`);
    }
  }
}
