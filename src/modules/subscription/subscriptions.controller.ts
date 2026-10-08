import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TransformResponseInterceptor } from '../../shared/interceptors/transform-response.interceptor';
import { TenantDatabaseService } from '../tenants/tenant-database.service';
import { PlanModulesGuard } from '../../shared/guards/plan-modules.guard';
import { CheckoutSessionService, PLAN_PRICES_SERVER } from './checkout-session.service';
import { FedaPayService } from '../payments/services/fedapay.service';

export class MerchantSubscribeDto {
  planCode!: 'FREE' | 'ESSENTIEL' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  durationDays?: number;
  provider?: string;
  paymentReference?: string;
  amount?: number;
}

export class PortalCreateSessionDto {
  planCode!: 'ESSENTIEL' | 'PRO' | 'BUSINESS';
  durationDays?: number;
  customerName!: string;
  customerPhone!: string;
  customerEmail?: string;
  // tenantId NEVER accepted from client — always resolved from JWT
}

export class CreatePortalSessionDto {
  tenantId!: string;
  shopId!: number;
}

@ApiTags('Subscriptions - Merchant App')
@Controller('subscriptions')
@UseInterceptors(TransformResponseInterceptor)
export class SubscriptionsController {
  constructor(
    private readonly tenantDb: TenantDatabaseService,
    private readonly checkoutSessionService: CheckoutSessionService,
    private readonly fedaPayService: FedaPayService,
  ) {}

  @Get('packages')
  @ApiOperation({ summary: 'Obtenir les forfaits SaaS disponibles' })
  async getPackages() {
    const db = this.tenantDb.getAdminClient();
    try {
      const { data } = await db.from('subscription_plans').select('*').order('price_monthly', { ascending: true });
      if (data && data.length > 0) {
        return data.map((plan: any) => ({
          id: plan.id,
          code: plan.code,
          name: plan.name,
          monthlyPrice: Number(plan.price_monthly),
          annualPrice: Number(plan.price_yearly),
          currency: 'FCFA',
          maxStores: plan.max_shops ?? 1,
          maxUsers: plan.max_users ?? 1,
          includedModules: plan.granted_modules || [],
          capabilities: plan.capabilities || (plan.code === 'FREE' ? [] : ['CLOUD_SYNC']),
          trialDays: plan.code === 'FREE' ? 0 : 14,
          status: plan.is_active !== false ? 'ACTIVE' : 'INACTIVE',
          description: plan.description || '',
        }));
      }
    } catch {
      // Error fetching packages from DB
    }

    return [
      {
        id: 'plan_free',
        code: 'FREE',
        name: 'ARIKE Gratuit (Starter)',
        monthlyPrice: 0,
        annualPrice: 0,
        currency: 'FCFA',
        maxStores: 1,
        maxUsers: 1,
        includedModules: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS', 'EXPENSES', 'CASH_SESSIONS', 'PROCUREMENT', 'REPORTS_BASIC'],
        capabilities: [],
        trialDays: 0,
        status: 'ACTIVE',
        description: '100% Hors-ligne local — 1 boutique — 1 utilisateur — Zéro frais à vie',
      },
      {
        id: 'plan_essentiel',
        code: 'ESSENTIEL',
        name: 'ARIKE Essentiel',
        monthlyPrice: 3000,
        annualPrice: 30000,
        currency: 'FCFA',
        maxStores: 1,
        maxUsers: 3,
        includedModules: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS', 'EXPENSES', 'CASH_SESSIONS', 'PROCUREMENT', 'REPORTS_BASIC'],
        capabilities: ['CLOUD_SYNC'],
        trialDays: 14,
        status: 'ACTIVE',
        description: 'Petit commerce — Sauvegarde cloud — 1 boutique — 3 utilisateurs',
      },
      {
        id: 'plan_pro',
        code: 'PRO',
        name: 'ARIKE Pro',
        monthlyPrice: 6000,
        annualPrice: 60000,
        currency: 'FCFA',
        maxStores: 2,
        maxUsers: 10,
        includedModules: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS', 'EXPENSES', 'CASH_SESSIONS', 'REPORTS_BASIC', 'SALES_ORDERS', 'PROCUREMENT', 'REPORTS_ADVANCED', 'AUDIT_LOG'],
        capabilities: ['CLOUD_SYNC', 'AI_ASSISTANT', 'MULTI_DEVICE'],
        trialDays: 14,
        status: 'ACTIVE',
        description: 'Boutique en croissance — Multi-boutiques & Stocks avancés — 2 boutiques — 10 utilisateurs',
      },
    ];
  }

  @Get('options')
  @ApiOperation({ summary: 'Obtenir les options payantes et add-ons actifs pour le commerçant' })
  async getPaidOptions() {
    const db = this.tenantDb.getAdminClient();
    try {
      const { data } = await db.from('paid_options').select('*').eq('is_active', true).order('price', { ascending: true });
      if (data && data.length > 0) {
        return data.map((opt: any) => ({
          id: opt.id,
          code: opt.code,
          name: opt.name,
          description: opt.description || '',
          price: Number(opt.price),
          priceDisplay: opt.price_display || `${opt.price} FCFA`,
          billingType: opt.billing_type || 'MONTHLY',
          unit: opt.unit || 'service',
          isActive: opt.is_active !== false,
        }));
      }
    } catch {
      // Error fetching options from DB
    }

    return [];
  }

  @Get('onboarding-policy')
  @ApiOperation({ summary: 'Obtenir la politique d\'onboarding et d\'activation d\'essai pour l\'application mobile' })
  async getOnboardingPolicy() {
    const db = this.tenantDb.getAdminClient();
    try {
      const { data } = await db.from('platform_settings').select('licensing_policy_json').eq('id', 'default').maybeSingle();
      if (data && data.licensing_policy_json) {
        const policy = data.licensing_policy_json;
        return {
          planSelectionRequired: true,
          trialEnabled: policy.trialEnabled !== false,
          trialDurationDays: Number(policy.trialDurationDays || 14),
          gracePeriodDays: Number(policy.gracePeriodDays || 7),
          defaultPlanCode: policy.defaultPlanCode || 'ESSENTIEL',
          allowPlanChangeDuringTrial: policy.allowPlanChangeDuringTrial !== false,
        };
      }
    } catch {
      // Fallback
    }

    return {
      planSelectionRequired: true,
      trialEnabled: true,
      trialDurationDays: 14,
      gracePeriodDays: 7,
      defaultPlanCode: 'ESSENTIEL',
      allowPlanChangeDuringTrial: true,
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Obtenir l\'état d\'abonnement du commerçant connecté' })
  async getMySubscription(@Headers('x-shop-id') shopHeader?: string) {
    const db = this.tenantDb.getAdminClient();
    const shopId = parseInt(shopHeader || '1', 10) || 1;

    try {
      const { data: shop } = await db.from('shops').select('*').eq('id', shopId).maybeSingle();
      const tenantUuid = shop?.server_id;

      // Récupérer les souscriptions dans la table dédiée `subscriptions`
      let sub: any = null;
      let allSubs: any[] = [];
      if (tenantUuid) {
        const { data: subsList } = await db
          .from('subscriptions')
          .select('*, subscription_plans(*)')
          .eq('tenant_id', tenantUuid)
          .order('created_at', { ascending: false });
        if (subsList && subsList.length > 0) {
          sub = subsList[0];
          allSubs = subsList;
        }
      }

      const expiresAtStr = sub?.expires_at || new Date(Date.now() + 30 * 86400000).toISOString();
      const expiresAt = new Date(expiresAtStr);
      const graceUntil = sub?.grace_until ? new Date(sub.grace_until) : new Date(expiresAt.getTime() + 7 * 86400000);
      const startedAt = sub?.started_at
        ? new Date(sub.started_at)
        : (typeof shop?.created_at === 'number' ? new Date(shop.created_at) : new Date());

      const now = Date.now();
      const isExpired = sub ? (now > graceUntil.getTime()) : false;

      let planCode = sub?.plan_code || shop?.plan || 'FREE';
      let computedStatus = sub?.status || (expiresAt.getTime() > now ? 'ACTIVE' : (graceUntil.getTime() > now ? 'GRACE' : 'EXPIRED'));

      // Rétrogradation douce en forfait permanent GRATUIT si expiré
      if (isExpired || computedStatus === 'EXPIRED') {
        planCode = 'FREE';
        computedStatus = 'ACTIVE';
      }

      const { data: planData } = await db.from('subscription_plans').select('*').eq('code', planCode).maybeSingle();

      const { count: currentUsersCount } = await db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId);

      const defaultModulesMap: Record<string, string[]> = {
        FREE: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS'],
        ESSENTIEL: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS', 'EXPENSES', 'CASH_SESSIONS', 'REPORTS_BASIC'],
        PRO: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS', 'EXPENSES', 'CASH_SESSIONS', 'REPORTS_BASIC', 'SALES_ORDERS', 'PROCUREMENT', 'REPORTS_ADVANCED', 'AUDIT_LOG'],
        BUSINESS: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS', 'EXPENSES', 'CASH_SESSIONS', 'REPORTS_BASIC', 'SALES_ORDERS', 'PROCUREMENT', 'REPORTS_ADVANCED', 'AUDIT_LOG', 'STOCK_TRANSFERS', 'FX_EXCHANGE', 'MULTI_SHOP'],
        ENTERPRISE: ['ALL_MODULES'],
      };

      const defaultCapabilitiesMap: Record<string, string[]> = {
        FREE: [],
        ESSENTIEL: ['CLOUD_SYNC'],
        PRO: ['CLOUD_SYNC', 'AI_ASSISTANT', 'MULTI_DEVICE'],
        BUSINESS: ['CLOUD_SYNC', 'AI_ASSISTANT', 'MULTI_DEVICE', 'MULTI_SHOP', 'API_EXPORT'],
        ENTERPRISE: ['CLOUD_SYNC', 'AI_ASSISTANT', 'MULTI_DEVICE', 'MULTI_SHOP', 'API_EXPORT', 'CUSTOM_INTEGRATIONS', 'DEDICATED_SUPPORT'],
      };

      const grantedModules = planData?.granted_modules || defaultModulesMap[planCode] || defaultModulesMap.FREE;
      const capabilities = planData?.capabilities || defaultCapabilitiesMap[planCode] || defaultCapabilitiesMap.FREE;
      const maxUsers = planData?.max_users || (planCode === 'BUSINESS' ? 30 : (planCode === 'PRO' ? 10 : (planCode === 'ESSENTIEL' ? 3 : 1)));
      const maxShops = planData?.max_shops || (planCode === 'BUSINESS' ? 5 : (planCode === 'PRO' ? 2 : 1));

      const paymentHistory = allSubs.map((s: any) => {
        const planName = s.subscription_plans?.name || `Abonnement ARIKE ${s.plan_code || 'Pro'}`;
        const amount = Number(s.amount) || Number(s.subscription_plans?.price_monthly) || 0;
        return {
          id: `sub_${s.id}`,
          date: s.created_at || s.started_at || new Date().toISOString(),
          planName: planName,
          planCode: s.plan_code,
          amount: amount,
          currency: s.currency || 'FCFA',
          provider: s.payment_method || 'Mobile Money (FedaPay)',
          reference: s.payment_reference || `REF-${String(s.id).substring(0, 8).toUpperCase()}`,
          status: s.status === 'ACTIVE' || s.status === 'TRIAL' ? 'PAYÉ' : s.status,
          expiresAt: s.expires_at,
          bonusDays: s.bonus_days || 0,
        };
      });

      return {
        planCode,
        planName: planData?.name || `ARIKE ${planCode.charAt(0) + planCode.slice(1).toLowerCase()}`,
        status: computedStatus,
        startedAt: startedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        graceUntil: graceUntil.toISOString(),
        autoRenew: false,
        grantedModules,
        capabilities,
        maxUsers,
        maxShops,
        currentUsersCount: currentUsersCount || 1,
        currentShopsCount: 1,
        paymentHistory,
      };
    } catch {
      return {
        planCode: 'FREE',
        planName: 'ARIKE Gratuit',
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        graceUntil: new Date(Date.now() + 372 * 86400000).toISOString(),
        autoRenew: false,
        grantedModules: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS'],
        capabilities: [],
        maxUsers: 1,
        maxShops: 1,
        currentUsersCount: 1,
        currentShopsCount: 1,
        paymentHistory: [],
      };
    }
  }

  @Post('switch-preview')
  @ApiOperation({ summary: 'Prévisualiser le report de jours et prorata lors d\'un changement de forfait' })
  async previewSwitch(
    @Headers('x-shop-id') shopHeader: string,
    @Body() dto: { targetPlanCode: string; durationDays?: number },
  ) {
    const db = this.tenantDb.getAdminClient();
    const shopId = parseInt(shopHeader || '1', 10) || 1;
    const targetPlan = dto.targetPlanCode || 'PRO';
    const durationDays = dto.durationDays || 30;

    const { data: shop } = await db.from('shops').select('*').eq('id', shopId).maybeSingle();
    const tenantUuid = shop?.server_id;

    let existingSub: any = null;
    if (tenantUuid) {
      const { data: subsList } = await db
        .from('subscriptions')
        .select('*, subscription_plans(*)')
        .eq('tenant_id', tenantUuid)
        .order('created_at', { ascending: false })
        .limit(1);
      if (subsList && subsList.length > 0) existingSub = subsList[0];
    }

    const { data: targetPlanData } = await db.from('subscription_plans').select('*').eq('code', targetPlan).maybeSingle();
    const { data: currentPlanData } = await db.from('subscription_plans').select('*').eq('code', existingSub?.plan_code || shop?.plan || 'FREE').maybeSingle();

    const now = Date.now();
    const existingExpires = existingSub?.expires_at ? new Date(existingSub.expires_at).getTime() : 0;
    const currentPlanCode = existingSub?.plan_code || shop?.plan || 'FREE';

    let transitionType: 'RENEWAL' | 'UPGRADE' | 'DOWNGRADE' | 'NEW' = 'NEW';
    let bonusDays = 0;
    let message = '';

    if (existingExpires > now && currentPlanCode !== 'FREE') {
      const remainingDays = Math.max(0, Math.ceil((existingExpires - now) / 86400000));
      const oldPrice = Number(currentPlanData?.price_monthly) || 0;
      const newPrice = Number(targetPlanData?.price_monthly) || 0;

      if (currentPlanCode === targetPlan) {
        transitionType = 'RENEWAL';
        message = `Renouvellement : votre forfait actuel sera prolongé de ${durationDays} jours supplémentaires.`;
      } else if (newPrice >= oldPrice) {
        transitionType = 'UPGRADE';
        const remainingValue = remainingDays * (oldPrice / 30);
        bonusDays = newPrice > 0 ? Math.floor(remainingValue / (newPrice / 30)) : 0;
        message = `Mise à niveau immédiate : vos ${remainingDays} jours restants de ${currentPlanData?.name || currentPlanCode} sont convertis en +${bonusDays} jours bonus sur votre nouveau forfait ${targetPlanData?.name || targetPlan} !`;
      } else {
        transitionType = 'DOWNGRADE';
        message = `Rétrogradation : vous conservez vos avantages ${currentPlanData?.name || currentPlanCode} jusqu'à la fin de votre période déjà payée (${remainingDays} jours restants). Le nouveau forfait prendra effet à l'échéance.`;
      }
    } else {
      transitionType = 'NEW';
      message = `Souscription : activation immédiate du forfait ${targetPlanData?.name || targetPlan} pour ${durationDays} jours.`;
    }

    return {
      currentPlanCode,
      targetPlanCode: targetPlan,
      transitionType,
      bonusDays,
      totalGrantedDays: durationDays + bonusDays,
      price: durationDays >= 360 ? Number(targetPlanData?.price_yearly) || 0 : Number(targetPlanData?.price_monthly) || 0,
      currency: 'FCFA',
      message,
    };
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Enregistrer le renouvellement ou changement d\'abonnement après paiement' })
  async subscribe(
    @Headers('x-shop-id') shopHeader: string,
    @Body() dto: MerchantSubscribeDto,
  ) {
    const db = this.tenantDb.getAdminClient();
    const shopId = parseInt(shopHeader || '1', 10) || 1;
    const durationDays = dto.durationDays || 30;
    const plan = dto.planCode || 'PRO';

    try {
      const { data: shop } = await db.from('shops').select('*').eq('id', shopId).maybeSingle();
      const tenantUuid = shop?.server_id;

      if (tenantUuid) {
        const { data: existingSub } = await db
          .from('subscriptions')
          .select('*, subscription_plans(*)')
          .eq('tenant_id', tenantUuid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const now = Date.now();
        const currentExpires = existingSub?.expires_at ? new Date(existingSub.expires_at).getTime() : 0;
        const currentPlanCode = existingSub?.plan_code || shop?.plan || 'FREE';

        const { data: planData } = await db.from('subscription_plans').select('*').eq('code', plan).maybeSingle();

        let bonusDays = 0;
        let expiresAt: Date;

        if (currentExpires > now && currentPlanCode !== 'FREE') {
          const remainingDays = Math.max(0, Math.ceil((currentExpires - now) / 86400000));
          const oldPrice = Number(existingSub?.subscription_plans?.price_monthly) || 0;
          const newPrice = Number(planData?.price_monthly) || 0;

          if (currentPlanCode === plan) {
            // Renouvellement du même forfait : extension cumulative
            expiresAt = new Date(currentExpires + durationDays * 86400000);
          } else if (newPrice >= oldPrice) {
            // Upgrade : immédiat avec report de la valeur restante en jours bonus
            const remainingValue = remainingDays * (oldPrice / 30);
            bonusDays = newPrice > 0 ? Math.floor(remainingValue / (newPrice / 30)) : 0;
            expiresAt = new Date(now + (durationDays + bonusDays) * 86400000);
          } else {
            // Downgrade : prend effet à la fin de la période en cours
            expiresAt = new Date(currentExpires + durationDays * 86400000);
          }
        } else {
          // Nouveau plan ou compte gratuit
          expiresAt = new Date(now + durationDays * 86400000);
        }

        const graceUntil = new Date(expiresAt.getTime() + 7 * 86400000);
        const amount = dto.amount ?? (plan === 'FREE' ? 0 : (durationDays >= 360 ? Number(planData?.price_yearly) || 0 : Number(planData?.price_monthly) || 0));

        await db.from('subscriptions').insert({
          tenant_id: tenantUuid,
          plan_id: planData?.id,
          plan_code: plan,
          status: 'ACTIVE',
          amount: amount,
          currency: 'FCFA',
          payment_method: dto.provider || 'Mobile Money',
          payment_reference: dto.paymentReference || `PAY-${Date.now()}`,
          bonus_days: bonusDays,
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          grace_until: graceUntil.toISOString(),
          auto_renew: false,
        });

        // Mettre à jour le plan direct sur le shop
        await db.from('shops').update({ plan }).eq('id', shopId);
      }
    } catch {}

    // Invalider le cache du PlanModulesGuard pour prise en compte immédiate
    PlanModulesGuard.invalidateCache(shopId);

    return this.getMySubscription(String(shopId));
  }

  // ================================================================
  // PORTAIL D'ABONNEMENT PUBLIC — Architecture v3
  // ================================================================

  /**
   * [PUBLIC] Étape 1 : Créer une checkout session opaque (30 min)
   * POST /api/subscriptions/portal/checkout-session
   * Le prix est TOUJOURS calculé côté serveur — jamais depuis le client.
   * Le client ne fournit que planCode + durationDays + infos client.
   */
  @Post('portal/checkout-session')
  @ApiOperation({ summary: '[PUBLIC] Créer une checkout session de paiement (prix serveur)' })
  async createCheckoutSession(@Body() dto: PortalCreateSessionDto) {
    const durationDays = dto.durationDays || 30;
    const planCode = dto.planCode;

    return this.checkoutSessionService.createCheckoutSession({
      planCode,
      durationDays,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerEmail: dto.customerEmail,
      // tenantId intentionally omitted — client cannot self-assign
    });
  }

  /**
   * [PUBLIC] Récupérer les infos d'une checkout session (plan, montant, client)
   * GET /api/subscriptions/portal/checkout-session/:id
   */
  @Get('portal/checkout-session/:id')
  @ApiOperation({ summary: '[PUBLIC] Obtenir les infos d\'une checkout session' })
  async getCheckoutSession(@Param('id') sessionId: string) {
    const session = await this.checkoutSessionService.getCheckoutSession(sessionId);
    if (!session) {
      return { error: 'Session introuvable ou expirée', expired: true };
    }
    // Ne retourner que les informations nécessaires à l'affichage
    return {
      planCode: session.plan_code,
      planName: PLAN_PRICES_SERVER[session.plan_code as keyof typeof PLAN_PRICES_SERVER]?.name || session.plan_code,
      amount: session.amount,
      currency: session.currency,
      durationDays: session.duration_days,
      customerName: session.customer_name,
      status: session.status,
      expiresAt: session.expires_at,
    };
  }

  /**
   * [PUBLIC] Étape 2 : Initier le paiement FedaPay pour une session
   * POST /api/subscriptions/portal/checkout-session/:id/payment
   * Le montant est RECALCULÉ côté serveur à partir du plan en session.
   * Le client ne transmet JAMAIS le montant.
   */
  @Post('portal/checkout-session/:id/payment')
  @ApiOperation({ summary: '[PUBLIC] Initier le paiement FedaPay pour une checkout session' })
  async initiateSessionPayment(
    @Param('id') sessionId: string,
    @Headers('origin') origin?: string,
  ) {
    const session = await this.checkoutSessionService.getCheckoutSession(sessionId);

    if (!session) {
      return { success: false, error: 'Session introuvable ou expirée' };
    }
    if (session.status !== 'PENDING') {
      return { success: false, error: `Session déjà traitée (statut : ${session.status})` };
    }

    // Prix recalculé côté serveur
    const planCode = session.plan_code as 'ESSENTIEL' | 'PRO' | 'BUSINESS';
    const planInfo = PLAN_PRICES_SERVER[planCode];
    const serverAmount = session.duration_days >= 360 ? planInfo.annual : planInfo.monthly;
    const baseUrl = origin || 'https://app.arike.com';

    // Tenter FedaPay
    const fedaRes = await this.fedaPayService.createTransaction({
      amount: serverAmount,
      description: `ARIKE ${planInfo.name} — ${session.duration_days >= 360 ? 'Annuel' : 'Mensuel'}`,
      phoneNumber: session.customer_phone,
      shopId: 0, // portail public — pas de shop_id encore
      planCode,
      durationDays: session.duration_days,
    });

    if (fedaRes.success && fedaRes.checkoutUrl) {
      return {
        success: true,
        paymentUrl: fedaRes.checkoutUrl,
        transactionId: fedaRes.transactionId,
        redirectUrl: `${baseUrl}/subscription/success`,
        cancelUrl: `${baseUrl}/subscription/cancel`,
      };
    }

    // FedaPay non configuré — fallback WhatsApp
    const whatsappNumber = '229015380499';
    const cycleLabel = session.duration_days >= 360 ? 'annuel' : 'mensuel';
    const priceLabel = `${serverAmount.toLocaleString('fr-FR')} FCFA/${session.duration_days >= 360 ? 'an' : 'mois'}`;
    const message = encodeURIComponent(
      `Bonjour ARIKE ! 👋\n\nJe souhaite m'abonner au forfait *ARIKE ${planInfo.name}* (${priceLabel} — ${cycleLabel}).\n\n📛 Nom : ${session.customer_name}\n📱 Téléphone : ${session.customer_phone}${session.customer_email ? `\n📧 Email : ${session.customer_email}` : ''}\n\nMerci de procéder à l'activation. (Réf. session : ${sessionId})`
    );

    return {
      success: true,
      paymentUrl: null,
      whatsappUrl: `https://wa.me/${whatsappNumber}?text=${message}`,
      sessionId,
    };
  }

  /**
   * [PUBLIC] Webhook FedaPay — Source de vérité de l'activation d'abonnement
   * POST /api/subscriptions/portal/webhook/fedapay
   *
   * Idempotence garantie via unique index sur fedapay_transaction_id.
   * La vérification est faite par FedaPayService.checkStatus (appel API FedaPay)
   * avant toute activation — jamais sur la seule parole du webhook.
   */
  @Post('portal/webhook/fedapay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[PUBLIC] Webhook FedaPay — activation sécurisée des abonnements portail' })
  async portalFedaPayWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ) {
    // Déléguer au FedaPayService existant qui gère déjà le webhook
    return this.fedaPayService.handleWebhook(body, headers);
  }

  /**
   * [PROTÉGÉ] Créer une portal session longue durée (24h) depuis l'app Flutter
   * POST /api/subscriptions/portal/portal-session
   * Nécessite que le tenant soit connu — fourni par le backend depuis le JWT, jamais par le client.
   */
  @Post('portal/portal-session')
  @ApiOperation({ summary: '[AUTH] Créer une portal session pour /subscription/manage' })
  async createPortalSession(
    @Headers('x-shop-id') shopHeader: string,
    @Headers('x-tenant-id') tenantHeader?: string,
  ) {
    const db = this.tenantDb.getAdminClient();
    const shopId = parseInt(shopHeader || '1', 10) || 1;

    // Résoudre le tenant depuis la base — jamais depuis le client
    const { data: shop } = await db.from('shops').select('server_id').eq('id', shopId).maybeSingle();
    const tenantId = shop?.server_id;

    if (!tenantId) {
      return { error: 'Boutique ou tenant introuvable' };
    }

    return this.checkoutSessionService.createPortalSession({ tenantId, shopId });
  }

  /**
   * [PUBLIC] Récupérer les données d'une portal session (statut abonnement, historique)
   * GET /api/subscriptions/portal/portal-session/:id
   */
  @Get('portal/portal-session/:id')
  @ApiOperation({ summary: '[PUBLIC] Obtenir les données d\'une portal session de gestion' })
  async getPortalSession(@Param('id') sessionId: string) {
    const session = await this.checkoutSessionService.getPortalSession(sessionId);

    if (!session) {
      return { error: 'Session introuvable ou expirée', expired: true };
    }

    // Récupérer le statut d'abonnement réel depuis le backend
    return this.getMySubscription(String(session.shop_id));
  }
}
