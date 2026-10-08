import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRED_MODULES_KEY,
  REQUIRED_CAPABILITIES_KEY,
} from '../decorators/require-module.decorator';
import { ErrorCode } from '../enums/error-code.enum';
import { AuthenticatedRequest } from '../interfaces/auth-context.interface';
import { TenantDatabaseService } from '../../modules/tenants/tenant-database.service';

@Injectable()
export class PlanModulesGuard implements CanActivate {
  // Cache en mémoire pour éviter d'interroger Supabase à chaque requête : shopId -> données du plan
  private static planCache = new Map<number, {
    planCode: string;
    status: string;
    grantedModules: string[];
    capabilities: string[];
    cachedUntil: number;
  }>();

  constructor(
    private readonly reflector: Reflector,
    private readonly tenantDb: TenantDatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModules = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_MODULES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requiredCapabilities = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_CAPABILITIES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      (!requiredModules || requiredModules.length === 0) &&
      (!requiredCapabilities || requiredCapabilities.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const auth = request.authContext;

    // Dérogation complète pour le SUPER_ADMIN
    if (auth && (auth.role === 'SUPER_ADMIN' || (auth.permissions && (auth.permissions as string[]).includes('*')))) {
      return true;
    }

    const shopId = auth?.shopId;
    if (!shopId) {
      return true; // TenantGuard gère l'absence de shopId
    }

    const planInfo = await this.getTenantPlanInfo(shopId);

    // 1. Vérification des capacités système requises (ex: CLOUD_SYNC)
    if (requiredCapabilities && requiredCapabilities.length > 0) {
      for (const cap of requiredCapabilities) {
        if (!planInfo.capabilities.includes(cap)) {
          throw new ForbiddenException({
            errorCode: ErrorCode.PLAN_CAPABILITY_NOT_INCLUDED,
            message: `La capacité système '${cap}' n'est pas incluse dans votre forfait actuel (${planInfo.planCode}). Passez à un forfait supérieur pour activer cette fonctionnalité.`,
            requiredCapability: cap,
            currentPlan: planInfo.planCode,
          });
        }
      }
    }

    // 2. Vérification des modules métier requis (ex: PROCUREMENT, FX_EXCHANGE, STOCK_TRANSFERS)
    if (requiredModules && requiredModules.length > 0) {
      for (const mod of requiredModules) {
        if (
          !planInfo.grantedModules.includes(mod) &&
          !planInfo.grantedModules.includes('ALL_MODULES')
        ) {
          throw new ForbiddenException({
            errorCode: ErrorCode.PLAN_MODULE_NOT_INCLUDED,
            message: `Le module '${mod}' n'est pas inclus dans votre forfait d'abonnement actuel (${planInfo.planCode}). Veuillez mettre à niveau votre abonnement pour y accéder.`,
            requiredModule: mod,
            currentPlan: planInfo.planCode,
          });
        }
      }
    }

    return true;
  }

  private async getTenantPlanInfo(shopId: number) {
    const now = Date.now();
    const cached = PlanModulesGuard.planCache.get(shopId);
    if (cached && cached.cachedUntil > now) {
      return cached;
    }

    const db = this.tenantDb.getAdminClient();

    try {
      const { data: shop } = await db.from('shops').select('*').eq('id', shopId).maybeSingle();
      const tenantUuid = shop?.server_id;

      let sub: any = null;
      if (tenantUuid) {
        const { data: subsList } = await db
          .from('subscriptions')
          .select('*, subscription_plans(*)')
          .eq('tenant_id', tenantUuid)
          .order('created_at', { ascending: false })
          .limit(1);
        if (subsList && subsList.length > 0) {
          sub = subsList[0];
        }
      }

      // Vérifier si l'abonnement a expiré (y compris la période de grâce de 7 jours par défaut)
      const expiresAt = sub?.expires_at ? new Date(sub.expires_at).getTime() : 0;
      const graceUntil = sub?.grace_until
        ? new Date(sub.grace_until).getTime()
        : (expiresAt ? expiresAt + 7 * 86400000 : 0);
      const isExpired = sub ? (now > (graceUntil || expiresAt)) : false;

      let planCode = sub?.plan_code || (shop as any)?.plan || 'FREE';
      let status = sub?.status || 'ACTIVE';

      // Rétrogradation douce en forfait FREE permanent si expiré au-delà de la grâce ou révoqué
      if (isExpired || status === 'EXPIRED' || status === 'REVOKED' || status === 'SUSPENDED') {
        planCode = 'FREE';
        status = 'FALLBACK_FREE';
      }

      // Récupérer la définition du plan
      const { data: planData } = await db.from('subscription_plans').select('*').eq('code', planCode).maybeSingle();

      const defaultModules: Record<string, string[]> = {
        FREE: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS', 'EXPENSES', 'CASH_SESSIONS', 'PROCUREMENT', 'REPORTS_BASIC'],
        ESSENTIEL: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS', 'EXPENSES', 'CASH_SESSIONS', 'PROCUREMENT', 'REPORTS_BASIC', 'SALES_ORDERS'],
        PRO: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS', 'EXPENSES', 'CASH_SESSIONS', 'REPORTS_BASIC', 'SALES_ORDERS', 'PROCUREMENT', 'REPORTS_ADVANCED', 'AUDIT_LOG'],
        BUSINESS: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS', 'EXPENSES', 'CASH_SESSIONS', 'REPORTS_BASIC', 'SALES_ORDERS', 'PROCUREMENT', 'REPORTS_ADVANCED', 'AUDIT_LOG', 'STOCK_TRANSFERS', 'FX_EXCHANGE', 'MULTI_SHOP'],
        ENTERPRISE: ['ALL_MODULES'],
      };

      const defaultCapabilities: Record<string, string[]> = {
        FREE: [],
        ESSENTIEL: ['CLOUD_SYNC'],
        PRO: ['CLOUD_SYNC', 'AI_ASSISTANT', 'MULTI_DEVICE'],
        BUSINESS: ['CLOUD_SYNC', 'AI_ASSISTANT', 'MULTI_DEVICE', 'MULTI_SHOP', 'API_EXPORT'],
        ENTERPRISE: ['CLOUD_SYNC', 'AI_ASSISTANT', 'MULTI_DEVICE', 'MULTI_SHOP', 'API_EXPORT', 'CUSTOM_INTEGRATIONS', 'DEDICATED_SUPPORT'],
      };

      let grantedModules: string[] = planData?.granted_modules || defaultModules[planCode] || defaultModules.FREE;
      // S'assurer que le module essentiel PROCUREMENT (Approvisionnements) est accessible à tous les commerces
      if (!grantedModules.includes('PROCUREMENT') && !grantedModules.includes('ALL_MODULES')) {
        grantedModules = [...grantedModules, 'PROCUREMENT'];
      }
      // S'assurer que SALES_ORDERS (Commandes clients) est garanti pour les forfaits PRO, BUSINESS, ENTERPRISE
      if (['PRO', 'BUSINESS', 'ENTERPRISE'].includes(planCode) && !grantedModules.includes('SALES_ORDERS') && !grantedModules.includes('ALL_MODULES')) {
        grantedModules = [...grantedModules, 'SALES_ORDERS'];
      }
      const capabilities = planData?.capabilities || defaultCapabilities[planCode] || defaultCapabilities.FREE;

      const result = {
        planCode,
        status,
        grantedModules,
        capabilities,
        cachedUntil: now + 30000, // 30 secondes de cache en mémoire
      };

      PlanModulesGuard.planCache.set(shopId, result);
      return result;
    } catch {
      // Fallback résilient en cas de déconnexion de la BDD
      const fallback = {
        planCode: 'PRO',
        status: 'OFFLINE_FALLBACK',
        grantedModules: ['SALES', 'INVENTORY', 'CUSTOMERS', 'DEBTS', 'EXPENSES', 'CASH_SESSIONS', 'PROCUREMENT', 'REPORTS_BASIC', 'SALES_ORDERS', 'REPORTS_ADVANCED', 'AUDIT_LOG'],
        capabilities: ['CLOUD_SYNC'],
        cachedUntil: now + 5000,
      };
      return fallback;
    }
  }

  public static invalidateCache(shopId?: number) {
    if (shopId) {
      PlanModulesGuard.planCache.delete(shopId);
    } else {
      PlanModulesGuard.planCache.clear();
    }
  }
}
