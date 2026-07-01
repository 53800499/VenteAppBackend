import { Injectable } from '@nestjs/common';
import { AuditAction, AuditModule } from '../../../../shared/enums/audit.enum';

const ACTION_LABELS: Record<string, string> = {
  [AuditAction.EMERGENCY_UNLOCK]: 'Déblocage d\'urgence',
  [AuditAction.USER_ROLE_CHANGED]: 'Changement de rôle',
  [AuditAction.USER_SHOP_ASSIGNED]: 'Affectation boutique',
  [AuditAction.RBAC_OVERRIDES_REPLACED]: 'Permissions personnalisées',
  [AuditAction.DEBT_CREATED]: 'Dette créée',
  [AuditAction.DEBT_PAYMENT_RECORDED]: 'Remboursement dette',
  [AuditAction.DEBT_FORGIVEN]: 'Dette pardonnée',
  [AuditAction.SALE_CREATED]: 'Vente enregistrée',
  [AuditAction.SALE_CANCELLED]: 'Vente annulée',
  [AuditAction.STOCK_ADJUSTED]: 'Ajustement de stock',
  [AuditAction.PRODUCT_PRICE_CHANGED]: 'Modification de prix',
  [AuditAction.PRODUCT_ARCHIVED]: 'Produit archivé',
  [AuditAction.PRODUCT_DELETED]: 'Produit supprimé',
  [AuditAction.CATEGORY_DELETED]: 'Catégorie supprimée',
  [AuditAction.SHOP_CREATED]: 'Boutique créée',
  [AuditAction.SHOP_UPDATED]: 'Boutique modifiée',
  [AuditAction.SHOP_DEACTIVATED]: 'Boutique désactivée',
  [AuditAction.SHOP_DEFAULT_SET]: 'Boutique par défaut',
  [AuditAction.SHOP_SWITCHED]: 'Changement de boutique',
  [AuditAction.CUSTOMER_ARCHIVED]: 'Client archivé',
  [AuditAction.CUSTOMER_CREATED]: 'Client créé',
  [AuditAction.CUSTOMER_UPDATED]: 'Client modifié',
  [AuditAction.SETTINGS_UPDATED]: 'Paramètres modifiés',
  [AuditAction.BACKUP_RECORDED]: 'Sauvegarde enregistrée',
  [AuditAction.SYNC_SETTINGS_UPDATED]: 'Sync cloud modifiée',
};

const MODULE_LABELS: Record<string, string> = {
  [AuditModule.AUTH]: 'Authentification',
  [AuditModule.SETTINGS]: 'Paramètres',
  [AuditModule.USERS]: 'Utilisateurs',
  [AuditModule.SALES]: 'Ventes',
  [AuditModule.DEBTS]: 'Dettes',
  [AuditModule.PRODUCTS]: 'Inventaire',
  [AuditModule.SHOPS]: 'Boutiques',
  [AuditModule.CUSTOMERS]: 'Clients',
};

@Injectable()
export class AuditLabelService {
  actionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action;
  }

  moduleLabel(module: string): string {
    return MODULE_LABELS[module] ?? module;
  }

  listFilterOptions() {
    return {
      modules: Object.values(AuditModule).map((code) => ({
        code,
        label: this.moduleLabel(code),
      })),
      actions: Object.values(AuditAction).map((code) => ({
        code,
        label: this.actionLabel(code),
      })),
    };
  }
}
