import * as crypto from 'crypto';
import * as https from 'https';
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

  private async fedapayFetch(
    path: string,
    init: { method?: string; headers?: Record<string, string>; body?: string } = {},
  ): Promise<{ res: { ok: boolean; status: number }; data: any }> {
    const url = new URL(`${this.baseUrl}${path}`);
    const bodyStr = init.body;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'FedaPay/v1 NodeBindings/1.0',
      Authorization: `Bearer ${this.secretKey}`,
      ...(init.headers || {}),
      ...(bodyStr !== undefined
        ? { 'Content-Length': String(Buffer.byteLength(bodyStr, 'utf8')) }
        : {}),
    };

    const { statusCode, rawText } = await new Promise<{
      statusCode: number;
      rawText: string;
    }>((resolve, reject) => {
      const req = https.request(
        url,
        {
          method: init.method || 'GET',
          headers,
          timeout: 20000,
        },
        (response) => {
          let chunks = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            chunks += chunk;
          });
          response.on('end', () => {
            resolve({ statusCode: response.statusCode || 500, rawText: chunks });
          });
        },
      );
      req.on('timeout', () => {
        req.destroy(new Error('Délai d’attente dépassé lors de la connexion à FedaPay'));
      });
      req.on('error', reject);
      if (bodyStr !== undefined) {
        req.write(bodyStr);
      }
      req.end();
    });

    const res = { ok: statusCode >= 200 && statusCode < 300, status: statusCode };
    const trimmed = rawText.trim();

    if (!trimmed) {
      return { res, data: {} };
    }

    if (trimmed.startsWith('<')) {
      this.logger.error(
        `FedaPay a renvoyé du HTML (HTTP ${statusCode}) sur ${path}: ${trimmed.slice(0, 200)}`,
      );
      throw new Error(
        `FedaPay a renvoyé une page HTML (HTTP ${statusCode}) au lieu de JSON. Vérifiez la clé/environnement FedaPay ou un blocage Cloudflare.`,
      );
    }

    try {
      return { res, data: JSON.parse(trimmed) };
    } catch {
      this.logger.error(
        `Réponse non-JSON de FedaPay (HTTP ${statusCode}) sur ${path}: ${trimmed.slice(0, 200)}`,
      );
      throw new Error(`Réponse invalide de FedaPay (HTTP ${statusCode})`);
    }
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

    const callbackUrl = dto.callbackUrl || this.getEnv('FEDAPAY_CALLBACK_URL');

    let customerFirstname = 'Boutique';
    let customerLastname = `#${dto.shopId}`;
    let customerEmail = `shop_${dto.shopId}@arike.app`;
    try {
      const { data: shop } = await this.supabase.db
        .from('shops')
        .select('name, email')
        .eq('id', dto.shopId)
        .maybeSingle();
      const rawName = typeof shop?.name === 'string' ? shop.name.trim() : '';
      if (rawName) {
        const parts = rawName.split(/\s+/);
        if (parts.length >= 2) {
          customerFirstname = parts[0];
          customerLastname = parts.slice(1).join(' ');
        } else {
          customerFirstname = rawName;
          customerLastname = 'Boutique';
        }
      }
      if (typeof shop?.email === 'string' && shop.email.includes('@')) {
        customerEmail = shop.email.trim();
      }
    } catch (_) {}

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
        firstname: customerFirstname,
        lastname: customerLastname,
        email: customerEmail,
        ...(phoneObj ? { phone_number: phoneObj } : {}),
      },
    };

    try {
      const { res, data } = await this.fedapayFetch('/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
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
    const body: any = {};
    if (mode) body.mode = mode;

    const { res, data } = await this.fedapayFetch(`/transactions/${transactionId}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

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
      const { res, data } = await this.fedapayFetch(`/transactions/${transactionId}`, {
        method: 'GET',
      });

      if (!res.ok) {
        return {
          success: false,
          status: 'unknown',
          message: data?.message || 'Erreur lors de la vérification FedaPay',
        };
      }

      const tx = data['v1/transaction'] || data.v1?.transaction || data.transaction || data;
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
   * Vérifie la signature HMAC FedaPay si présente et si FEDAPAY_WEBHOOK_SECRET est configuré.
   */
  private verifyWebhookSignature(body: any, headers?: Record<string, string>): boolean {
    const webhookSecret = this.getEnv('FEDAPAY_WEBHOOK_SECRET');
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

      try {
        await this.supabase.db.from('fedapay_webhook_events').insert({
          tx_id: txId,
          event_name: String(event || ''),
          status: String(rawStatus || ''),
          payload: body,
          processed: false,
        });
      } catch (_) {}

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

      // 2. Vérifier la souscription existante pour distinction Renouvellement / Upgrade / Downgrade
      const { data: existingSub } = await db
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('tenant_id', tenantUuid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nowMs = now.getTime();
      const currentExpires = existingSub?.expires_at
        ? new Date(existingSub.expires_at).getTime()
        : 0;
      const hasActivePaidPeriod =
        currentExpires > nowMs &&
        (existingSub?.plan_code || 'FREE').toUpperCase() !== 'FREE' &&
        existingSub?.status !== 'REVOKED' &&
        existingSub?.status !== 'SUSPENDED';

      const currentPlan = (existingSub?.plan_code || (shop as any)?.plan || 'FREE').toUpperCase();
      const isAddonPurchase = Boolean(addonCode && !planCode);
      const requestedPlan = isAddonPurchase
        ? currentPlan
        : (planCode || existingSub?.plan_code || (shop as any)?.plan || 'ESSENTIEL').toUpperCase();

      // 3. Charger le tarif officiel du plan demandé et vérifier devise + montant
      const { data: planData } = await db
        .from('subscription_plans')
        .select('id, code, name, price_monthly, price_yearly')
        .eq('code', requestedPlan)
        .maybeSingle();

      const txCurrency = entity?.currency?.iso || entity?.currency_iso;
      if (txCurrency && String(txCurrency).toUpperCase() !== 'XOF') {
        this.logger.warn(`Transaction FedaPay ${txId} rejetée : devise invalide (${txCurrency})`);
        throw new Error(`Devise invalide (${txCurrency})`);
      }

      const paidAmount = entity?.amount ? Number(entity.amount) : null;
      if (!isAddonPurchase) {
        const monthlyPrice = Number(planData?.price_monthly) || 0;
        const yearlyPrice = Number(planData?.price_yearly) || monthlyPrice * 10;
        const expectedMinAmount =
          durationDays >= 360
            ? yearlyPrice
            : durationDays >= 90
              ? monthlyPrice * 3
              : monthlyPrice;

        if (paidAmount !== null && expectedMinAmount > 0 && paidAmount < expectedMinAmount) {
          this.logger.warn(
            `Transaction FedaPay ${txId} rejetée : montant payé (${paidAmount}) inférieur au tarif attendu (${expectedMinAmount}) pour ${requestedPlan}`,
          );
          throw new Error(`Montant payé (${paidAmount} FCFA) inférieur au tarif du forfait (${expectedMinAmount} FCFA).`);
        }
      }

      const oldMonthlyPrice = Number(existingSub?.subscription_plans?.price_monthly) || 0;
      const monthlyPriceForCompare = Number(planData?.price_monthly) || 0;
      let transitionType: 'NEW_SUBSCRIPTION' | 'RENEWAL' | 'UPGRADE' | 'DOWNGRADE_SCHEDULED' | 'ADDON' =
        isAddonPurchase ? 'ADDON' : 'NEW_SUBSCRIPTION';
      let appliedPlan = requestedPlan;
      let scheduledPlanCode: string | null = null;
      let scheduledDurationDays: number | null = null;
      let scheduledEffectiveAt: string | null = null;

      if (!isAddonPurchase && hasActivePaidPeriod) {
        if (currentPlan === requestedPlan) {
          transitionType = 'RENEWAL';
        } else if (monthlyPriceForCompare >= oldMonthlyPrice) {
          // Upgrade immédiat + cumul des jours restants
          transitionType = 'UPGRADE';
        } else {
          // Downgrade programmé : le forfait actuel reste actif jusqu'à sa date d'expiration
          transitionType = 'DOWNGRADE_SCHEDULED';
          appliedPlan = currentPlan;
          scheduledPlanCode = requestedPlan;
          scheduledDurationDays = durationDays;
          scheduledEffectiveAt = new Date(currentExpires).toISOString();
        }
      }

      const baseTime = hasActivePaidPeriod ? currentExpires : nowMs;
      const expiresAt = isAddonPurchase
        ? new Date(hasActivePaidPeriod ? currentExpires : nowMs + durationDays * 86400000)
        : new Date(baseTime + durationDays * 86400000);
      const graceUntil = new Date(expiresAt.getTime() + 7 * 86400000);

      const { data: appliedPlanData } =
        appliedPlan === requestedPlan
          ? { data: planData }
          : await db.from('subscription_plans').select('id, price_monthly').eq('code', appliedPlan).maybeSingle();

      const insertPayload: Record<string, any> = {
        tenant_id: tenantUuid,
        plan_id: appliedPlanData?.id ?? planData?.id,
        plan_code: appliedPlan,
        status: 'ACTIVE',
        amount: paidAmount ?? (Number(planData?.price_monthly) || 0),
        currency: 'FCFA',
        payment_method: isAddonPurchase ? `FedaPay (Option: ${addonCode})` : 'FedaPay',
        payment_reference: paymentReference,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        grace_until: graceUntil.toISOString(),
        auto_renew: false,
      };

      if (scheduledPlanCode) {
        insertPayload.scheduled_plan_code = scheduledPlanCode;
        insertPayload.scheduled_duration_days = scheduledDurationDays;
        insertPayload.scheduled_effective_at = scheduledEffectiveAt;
      }

      const { error: insertError } = await db.from('subscriptions').insert(insertPayload);
      if (insertError) {
        if (insertError.code === '23505') {
          this.logger.log(`Transaction FedaPay ${txId} déjà insérée (contrainte UNIQUE) — idempotence garantie`);
          return;
        }
        throw new Error(insertError.message);
      }

      try {
        await db.from('subscription_transitions').insert({
          tenant_id: tenantUuid,
          shop_id: shopId,
          from_plan: currentPlan,
          to_plan: requestedPlan,
          transition_type: transitionType,
          effective_at: scheduledEffectiveAt || now.toISOString(),
          payment_reference: paymentReference,
          reason: `FedaPay ${transitionType} (${durationDays}j)`,
        });
      } catch (_) {}

      // 4. Synchroniser la projection `shops.plan` depuis la source de vérité `subscriptions`
      await db
        .from('shops')
        .update({
          plan: appliedPlan,
          is_active: true,
          subscription_expires_at: expiresAt.toISOString(),
        })
        .eq('id', shopId);

      PlanModulesGuard.invalidateCache(shopId);

      this.logger.log(
        `Shop ${shopId} (tenant: ${tenantUuid}) ${transitionType} via FedaPay (${paymentReference}): plan=${appliedPlan}, scheduled=${scheduledPlanCode ?? 'none'}, expire=${expiresAt.toISOString()}`,
      );
    } catch (err: any) {
      this.logger.error(`Échec applySubscriptionUpgrade FedaPay pour shop ${shopId}: ${err.message}`);
      throw err;
    } finally {
      if (txId) {
        this.processingTxIds.delete(txId);
      }
    }
  }
}
