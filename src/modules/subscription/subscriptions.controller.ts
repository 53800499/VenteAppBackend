import { Body, Controller, Get, Headers, Post, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TransformResponseInterceptor } from '../../shared/interceptors/transform-response.interceptor';
import { TenantDatabaseService } from '../tenants/tenant-database.service';

export class MerchantSubscribeDto {
  planCode!: 'ESSENTIEL' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
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
          trialDays: 14,
          status: plan.is_active !== false ? 'ACTIVE' : 'INACTIVE',
          description: plan.description || '',
        }));
      }
    } catch {
      // Fallback
    }
    return [];
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
      // Fallback
    }

    return [
      {
        id: 'opt-extra-shop',
        code: 'EXTRA_SHOP',
        name: 'Boutique supplémentaire',
        description: 'Ajoute un emplacement ou point de vente supplémentaire à votre entreprise.',
        price: 1500,
        priceDisplay: '1 500 FCFA/mois',
        billingType: 'MONTHLY',
        unit: 'boutique',
        isActive: true,
      },
      {
        id: 'opt-user-pack-5',
        code: 'USER_PACK_5',
        name: 'Pack de 5 utilisateurs supplémentaires',
        description: 'Étendez l\'accès de votre équipe avec 5 comptes d\'utilisateurs en plus.',
        price: 1000,
        priceDisplay: '1 000 FCFA/mois',
        billingType: 'MONTHLY',
        unit: 'pack_5_utilisateurs',
        isActive: true,
      },
      {
        id: 'opt-ai-assistant',
        code: 'AI_ASSISTANT',
        name: 'Assistant ARIKE intelligent',
        description: 'Conseils IA de réassort, prévisions des ventes et alertes d\'optimisation de stock.',
        price: 1500,
        priceDisplay: '1 500 à 2 000 FCFA/mois',
        billingType: 'MONTHLY',
        unit: 'service',
        isActive: true,
      },
      {
        id: 'opt-fx-change',
        code: 'FX_CHANGE',
        name: 'Bureau de change',
        description: 'Module de gestion des devises, taux de change en direct et comptabilité multi-devises.',
        price: 2000,
        priceDisplay: '2 000 FCFA/mois',
        billingType: 'MONTHLY',
        unit: 'service',
        isActive: true,
      },
      {
        id: 'opt-initial-training',
        code: 'INITIAL_TRAINING',
        name: 'Formation et accompagnement initial',
        description: 'Prise en main guidée sur site ou à distance, paramétrage initial et formation de votre équipe.',
        price: 25000,
        priceDisplay: 'Paiement unique',
        billingType: 'ONE_TIME',
        unit: 'prestation',
        isActive: true,
      },
      {
        id: 'opt-premium-support',
        code: 'PREMIUM_SUPPORT',
        name: 'Support premium',
        description: 'Assistance prioritaire 24/7 par téléphone et WhatsApp avec un gestionnaire de compte dédié.',
        price: 0,
        unit: 'sur_devis',
        isActive: true,
      },
    ];
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
      const { data: org } = shop?.organization_id
        ? await db.from('organizations').select('*').eq('id', shop.organization_id).maybeSingle()
        : { data: null };

      const planCode = org?.plan || shop?.plan || 'PRO';

      const { data: planData } = await db.from('subscription_plans').select('*').eq('code', planCode).maybeSingle();

      const { count: currentUsersCount } = await db
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', shopId);

      const { data: sub } = await db
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', String(shopId))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: payments } = await db
        .from('payments')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(10);

      const expiresAtStr = sub?.expires_at || org?.subscription_expires_at || shop?.subscription_expires_at || new Date(Date.now() + 365 * 86400000).toISOString();
      const expiresAt = new Date(expiresAtStr);
      const graceUntil = sub?.grace_until ? new Date(sub.grace_until) : new Date(expiresAt.getTime() + 7 * 86400000);
      const startedAt = sub?.started_at ? new Date(sub.started_at) : (shop?.created_at ? new Date(shop.created_at) : new Date());

      const computedStatus = sub?.status || (expiresAt.getTime() > Date.now() ? 'ACTIVE' : (graceUntil.getTime() > Date.now() ? 'GRACE' : 'EXPIRED'));

      const modulesMap: Record<string, string[]> = {
        ESSENTIEL: [
          'Vente & Encaissement',
          'Stock avancé & Alertes rupture',
          'Dépenses & Charges de caisse',
          'Approvisionnements & Commandes clients',
          'Rapports de ventes quotidiens',
          'Mode 100% Offline',
        ],
        PRO: [
          'Vente & Encaissement',
          'Stock Avancé',
          'Dépenses & Charges',
          'Approvisionnements & Commandes',
          'Bureau de Change FX',
          'Assistant Vocal ARIKE',
          'Transferts de stock inter-boutiques',
          'Analyses & Statistiques avancées',
          'Mode 100% Offline',
        ],
        BUSINESS: [
          'Vente & Encaissement',
          'Stock Avancé',
          'Dépenses & Charges',
          'Approvisionnements & Commandes',
          'Bureau de Change FX',
          'Assistant Vocal ARIKE',
          'Transferts de stock inter-boutiques',
          'Analyses & Statistiques avancées',
          'Multi-entreprises & Distributeurs',
          'Accès API dédiée & Export complet',
          'Mode 100% Offline',
        ],
      };

      const grantedModules = planData?.granted_modules || modulesMap[planCode] || modulesMap['PRO'];
      const maxUsers = planData?.max_users || (planCode === 'BUSINESS' ? 30 : (planCode === 'PRO' ? 10 : 3));
      const maxShops = planData?.max_shops || (planCode === 'BUSINESS' ? 5 : (planCode === 'PRO' ? 2 : 1));

      return {
        planCode,
        planName: planData?.name || `ARIKE ${planCode.charAt(0) + planCode.slice(1).toLowerCase()}`,
        status: expiresAt.getTime() > Date.now() ? 'ACTIVE' : (graceUntil.getTime() > Date.now() ? 'GRACE' : 'EXPIRED'),
        startedAt: startedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        graceUntil: graceUntil.toISOString(),
        autoRenew: false,
        grantedModules,
        maxUsers,
        maxShops,
        currentUsersCount: currentUsersCount || 1,
        currentShopsCount: 1,
        paymentHistory: (payments || []).map((p: any) => ({
          id: `tx_${p.id}`,
          date: p.created_at || new Date().toISOString(),
          planName: `Abonnement ARIKE ${planCode}`,
          amount: Number(p.amount) || 0,
          currency: 'FCFA',
          provider: p.method || 'Mobile Money',
          status: 'PAYÉ',
        })),
      };
    } catch {
      return {
        planCode: 'PRO',
        planName: 'ARIKE Pro',
        status: 'ACTIVE',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        graceUntil: new Date(Date.now() + 372 * 86400000).toISOString(),
        autoRenew: false,
        grantedModules: [
          'Vente & Encaissement',
          'Stock Avancé',
          'Dépenses & Charges',
          'Approvisionnements & Commandes',
          'Bureau de Change FX',
          'Assistant Vocal ARIKE',
          'Transferts de stock inter-boutiques',
          'Statistiques & Analyses',
        ],
        maxUsers: 10,
        maxShops: 2,
        currentUsersCount: 1,
        currentShopsCount: 1,
        paymentHistory: [],
      };
    }
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
      const currentExpires = shop?.subscription_expires_at ? new Date(shop.subscription_expires_at).getTime() : Date.now();
      const baseTime = currentExpires > Date.now() ? currentExpires : Date.now();
      const newExpiresAt = new Date(baseTime + durationDays * 86400000).toISOString();

      await db.from('shops').update({
        plan,
        subscription_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      }).eq('id', shopId);

      if (shop?.organization_id) {
        await db.from('organizations').update({
          plan,
          subscription_expires_at: newExpiresAt,
        }).eq('id', shop.organization_id);
      }

      if (dto.amount && dto.amount > 0) {
        await db.from('payments').insert({
          shop_id: shopId,
          amount: dto.amount,
          method: dto.provider || 'mobile_money',
          reference: dto.paymentReference || `PAY-${Date.now()}`,
          status: 'confirmed',
          created_at: new Date().toISOString(),
        });
      }
    } catch {}

    return this.getMySubscription(String(shopId));
  }
}
