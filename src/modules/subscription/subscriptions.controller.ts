import { Body, Controller, Get, Headers, Post, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TransformResponseInterceptor } from '../../shared/interceptors/transform-response.interceptor';
import { TenantDatabaseService } from '../tenants/tenant-database.service';
import { PlanModulesGuard } from '../../shared/guards/plan-modules.guard';

export class MerchantSubscribeDto {
  planCode!: 'FREE' | 'ESSENTIEL' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
  durationDays?: number;
  provider?: string;
  paymentReference?: string;
  amount?: number;
}

@ApiTags('Subscriptions - Merchant App')
@Controller('subscriptions')
@UseInterceptors(TransformResponseInterceptor)
export class SubscriptionsController {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

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

    const { data: shop } = await db.from('shops').select('server_id, plan').eq('id', shopId).maybeSingle();
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
}
