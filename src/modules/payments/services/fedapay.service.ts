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
    return this.configService.get<string>('FEDAPAY_ENVIRONMENT') || 'live';
  }

  private get baseUrl(): string {
    return this.environment === 'live'
      ? 'https://api.fedapay.com/v1'
      : 'https://sandbox-api.fedapay.com/v1';
  }

  /**
   * Créer une transaction FedaPay
   */
  async createTransaction(dto: CreateFedaPayTransactionDto) {
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
        throw new Error(data.message || 'Erreur lors de la création FedaPay');
      }

      const transaction = data.v1?.transaction || data.transaction || data;
      const transactionId = transaction.id;

      // Générer le token / URL de paiement
      const tokenResult = await this.generateToken(transactionId, dto.mode);

      return {
        success: true,
        transactionId: transactionId,
        token: tokenResult.token,
        checkoutUrl: tokenResult.url,
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
    const result = data.v1 || data;
    return {
      token: result.token,
      url: result.url,
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
      const tx = data.v1?.transaction || data.transaction || data;
      const status = tx.status;

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
  async handleWebhook(body: any) {
    this.logger.log(`FedaPay Webhook payload reçu: ${JSON.stringify(body)}`);

    const event = body.name || body.event || body.type || '';
    const entity = body.entity || body.data?.object || body.transaction || body;
    const status = entity?.status || body.status || '';

    this.logger.log(`FedaPay Webhook analysé: event=${event}, status=${status}`);

    if (status === 'approved' || status === 'transferred' || event === 'transaction.approved' || event === 'approved') {
      let metadata = entity.custom_metadata || entity.metadata || body.custom_metadata || {};
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
        await this.applySubscriptionUpgrade(Number(shopId), planCode, durationDays, addonCode, entity);
      } else {
        this.logger.warn(`Webhook FedaPay approuvé mais shop_id manquant dans metadata: ${JSON.stringify(metadata)}`);
      }
    }

    return { received: true };
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
        .select('id, plan, subscription_expires_at, granted_modules, organization_id')
        .eq('id', shopId)
        .maybeSingle();

      if (!shop) {
        this.logger.error(`Shop ${shopId} non trouvé pour mise à jour FedaPay`);
        return;
      }

      const currentExpires = shop.subscription_expires_at
        ? new Date(shop.subscription_expires_at).getTime()
        : now.getTime();
      const baseTime = currentExpires > now.getTime() ? currentExpires : now.getTime();
      const expiresAt = new Date(baseTime + durationDays * 86400000);
      const graceUntil = new Date(expiresAt.getTime() + 7 * 86400000);

      const targetPlan = planCode || shop.plan || 'ESSENTIEL';

      const updatePayload: any = {
        plan: targetPlan,
        subscription_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      };

      if (addonCode) {
        const existingModules = Array.isArray(shop.granted_modules)
          ? shop.granted_modules
          : [];
        if (!existingModules.includes(addonCode)) {
          updatePayload.granted_modules = [...existingModules, addonCode];
        }
      }

      // Update shop
      await db.from('shops').update(updatePayload).eq('id', shopId);

      // Update organization if exists
      if (shop.organization_id) {
        await db.from('organizations').update({
          plan: targetPlan,
          subscription_expires_at: expiresAt.toISOString(),
        }).eq('id', shop.organization_id);
      }

      // Record active subscription
      try {
        const { data: planData } = await db.from('subscription_plans').select('id').eq('code', targetPlan).maybeSingle();
        await db.from('subscriptions').insert({
          tenant_id: String(shopId),
          plan_id: planData?.id,
          plan_code: targetPlan,
          status: 'ACTIVE',
          started_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          grace_until: graceUntil.toISOString(),
          auto_renew: false,
        });
      } catch (subErr: any) {
        this.logger.warn(`Insertion table subscriptions omise ou échouée: ${subErr.message}`);
      }

      // Record payment log
      try {
        const amount = entity?.amount ? Number(entity.amount) : 0;
        const txId = entity?.id ? String(entity.id) : `FEDA-${Date.now()}`;
        await db.from('payments').insert({
          shop_id: shopId,
          amount: amount,
          method: 'FedaPay Mobile Money',
          reference: txId,
          status: 'confirmed',
          created_at: now.toISOString(),
        });
      } catch (payErr: any) {
        this.logger.warn(`Insertion table payments omise ou échouée: ${payErr.message}`);
      }

      this.logger.log(`Shop ${shopId} mis à jour avec succès via FedaPay: plan=${targetPlan}, expire=${expiresAt.toISOString()}`);
    } catch (err: any) {
      this.logger.error(`Échec applySubscriptionUpgrade FedaPay pour shop ${shopId}: ${err.message}`);
    }
  }
}
