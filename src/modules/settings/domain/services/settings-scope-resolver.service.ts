import { Injectable } from '@nestjs/common';
import { SettingsRegistryService } from './settings-registry.service';

export interface EffectiveSettingsSnapshotDto {
  version: number;
  scope: string;
  scopeId: string;
  updatedAt: string;
  settings: {
    company: Record<string, any>;
    sales: Record<string, any>;
    inventory: Record<string, any>;
    orders: Record<string, any>;
    procurement: Record<string, any>;
    debts: Record<string, any>;
    cash: Record<string, any>;
    receipts: Record<string, any>;
    notifications: Record<string, any>;
    sync: Record<string, any>;
    security: Record<string, any>;
  };
}

@Injectable()
export class SettingsScopeResolverService {
  constructor(private readonly registryService: SettingsRegistryService) {}

  /**
   * Calcule le snapshot effectif des paramètres pour une boutique donnée en appliquant
   * la hiérarchie : Plateforme -> Organisation -> Boutique -> Utilisateur -> Appareil
   */
  resolveEffectiveSnapshot(params: {
    shopId: string;
    organizationSettings?: Record<string, any>;
    shopSettings?: Record<string, any>;
    userSettings?: Record<string, any>;
    version?: number;
  }): EffectiveSettingsSnapshotDto {
    const definitions = this.registryService.getAllDefinitions();
    const effectiveValues: Record<string, any> = {};

    // 1. Appliquer les valeurs par défaut globales (Plateforme)
    for (const def of definitions) {
      effectiveValues[def.key] = def.defaultValue;
    }

    // 2. Fusionner avec les paramètres Organisation
    if (params.organizationSettings) {
      for (const [key, val] of Object.entries(params.organizationSettings)) {
        if (val !== undefined && val !== null) {
          effectiveValues[key] = val;
        }
      }
    }

    // 3. Fusionner avec les paramètres Boutique
    if (params.shopSettings) {
      for (const [key, val] of Object.entries(params.shopSettings)) {
        if (val !== undefined && val !== null) {
          effectiveValues[key] = val;
        }
      }
    }

    // 4. Fusionner avec les paramètres Utilisateur (si autorisés)
    if (params.userSettings) {
      for (const [key, val] of Object.entries(params.userSettings)) {
        const def = this.registryService.getDefinition(key);
        if (def && def.allowedScopes.includes('USER') && val !== undefined && val !== null) {
          effectiveValues[key] = val;
        }
      }
    }

    return {
      version: params.version ?? 1,
      scope: 'SHOP',
      scopeId: params.shopId,
      updatedAt: new Date().toISOString(),
      settings: {
        company: {
          name: params.shopSettings?.['company.name'] ?? 'Ma Boutique',
          phone: params.shopSettings?.['company.phone'] ?? null,
          address: params.shopSettings?.['company.address'] ?? null,
          currency: 'FCFA',
          language: 'fr',
        },
        sales: {
          allowCredit: effectiveValues['sales.allowCredit'] ?? true,
          allowDiscount: effectiveValues['sales.allowDiscount'] ?? true,
          maxDiscountPercent: effectiveValues['sales.maxDiscountPercent'] ?? 100,
          allowPriceOverride: effectiveValues['sales.allowPriceOverride'] ?? true,
          requireSaleConfirmation: effectiveValues['sales.requireSaleConfirmation'] ?? false,
          allowMinimumPriceBypass: effectiveValues['sales.allowMinimumPriceBypass'] ?? false,
        },
        inventory: {
          negativeStockMode: effectiveValues['inventory.negativeStockMode'] ?? 'WARNING',
          defaultAlertThreshold: effectiveValues['inventory.defaultAlertThreshold'] ?? 5,
          trackLots: effectiveValues['inventory.trackLots'] ?? false,
        },
        orders: {
          allowPartialDelivery: effectiveValues['orders.allowPartialDelivery'] ?? true,
          allowCustomerRefusal: effectiveValues['orders.allowCustomerRefusal'] ?? true,
          allowProductReplacement: effectiveValues['orders.allowProductReplacement'] ?? true,
        },
        procurement: {
          requireSupplierInvoice: effectiveValues['procurement.requireSupplierInvoice'] ?? false,
          defaultPaymentTermsDays: effectiveValues['procurement.defaultPaymentTermsDays'] ?? 30,
        },
        debts: {
          allowCreditSales: effectiveValues['debts.allowCreditSales'] ?? true,
          defaultCreditLimit: effectiveValues['debts.defaultCreditLimit'] ?? 0,
          maxOverdueDays: effectiveValues['debts.maxOverdueDays'] ?? 60,
        },
        cash: {
          requireCashSessionOpening: effectiveValues['cash.requireCashSessionOpening'] ?? false,
          requireCashSessionClosing: effectiveValues['cash.requireCashSessionClosing'] ?? false,
          allowNegativeCashBalance: effectiveValues['cash.allowNegativeCashBalance'] ?? true,
        },
        receipts: {
          autoPrint: effectiveValues['receipts.autoPrint'] ?? false,
          receiptFooter: params.shopSettings?.['receipts.receiptFooter'] ?? null,
          showQrCode: effectiveValues['receipts.showQrCode'] ?? true,
        },
        notifications: {
          lowStockAlerts: effectiveValues['notifications.lowStockAlerts'] ?? true,
          dailySummary: effectiveValues['notifications.dailySummary'] ?? true,
          syncAlerts: effectiveValues['notifications.syncAlerts'] ?? true,
        },
        sync: {
          enabled: effectiveValues['sync.enabled'] ?? true,
          wifiOnly: effectiveValues['sync.wifiOnly'] ?? false,
          lastAt: Date.now(),
        },
        security: {
          autoLockMinutes: effectiveValues['security.autoLockMinutes'] ?? 5,
          requireBiometrics: effectiveValues['security.requireBiometrics'] ?? false,
        },
      },
    };
  }
}
