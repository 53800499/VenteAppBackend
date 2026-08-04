import { Injectable } from '@nestjs/common';

export type SettingScope = 'PLATFORM' | 'ORGANIZATION' | 'SHOP' | 'USER' | 'DEVICE';
export type SettingType = 'boolean' | 'number' | 'string' | 'enum';

export interface SettingDefinition<T = any> {
  key: string;
  type: SettingType;
  defaultValue: T;
  allowedScopes: SettingScope[];
  description: string;
  allowedValues?: T[];
  minVersion: number;
}

@Injectable()
export class SettingsRegistryService {
  private readonly registry = new Map<string, SettingDefinition>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    // Ventes
    this.register({
      key: 'sales.allowCredit',
      type: 'boolean',
      defaultValue: true,
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Autoriser les ventes à crédit',
      minVersion: 1,
    });
    this.register({
      key: 'sales.allowDiscount',
      type: 'boolean',
      defaultValue: true,
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Autoriser l\'application de remises sur les ventes',
      minVersion: 1,
    });
    this.register({
      key: 'sales.maxDiscountPercent',
      type: 'number',
      defaultValue: 100,
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Pourcentage de remise maximal autorisé',
      minVersion: 1,
    });
    this.register({
      key: 'sales.allowPriceOverride',
      type: 'boolean',
      defaultValue: true,
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Autoriser la modification manuelle du prix unitaire lors des ventes',
      minVersion: 1,
    });

    // Stock
    this.register({
      key: 'inventory.negativeStockMode',
      type: 'enum',
      defaultValue: 'WARNING',
      allowedValues: ['ALLOW', 'WARNING', 'DENY'],
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Mode de gestion du stock négatif (ALLOW, WARNING, DENY)',
      minVersion: 1,
    });
    this.register({
      key: 'inventory.defaultAlertThreshold',
      type: 'number',
      defaultValue: 5,
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Seuil d\'alerte de stock bas par défaut',
      minVersion: 1,
    });

    // Caisse
    this.register({
      key: 'cash.requireCashSessionOpening',
      type: 'boolean',
      defaultValue: false,
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Exiger l\'ouverture explicite d\'une session de caisse avant encaissement',
      minVersion: 1,
    });
    this.register({
      key: 'cash.requireCashSessionClosing',
      type: 'boolean',
      defaultValue: false,
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Exiger la clôture de caisse en fin de journée',
      minVersion: 1,
    });

    // Commandes & Livraisons
    this.register({
      key: 'orders.allowPartialDelivery',
      type: 'boolean',
      defaultValue: true,
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Autoriser les livraisons partielles de commandes',
      minVersion: 1,
    });
    this.register({
      key: 'orders.allowProductReplacement',
      type: 'boolean',
      defaultValue: true,
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Autoriser le remplacement d\'articles dans les commandes',
      minVersion: 1,
    });

    // Dettes & Crédit
    this.register({
      key: 'debts.allowCreditSales',
      type: 'boolean',
      defaultValue: true,
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Autoriser l\'octroi de crédit aux clients',
      minVersion: 1,
    });
    this.register({
      key: 'debts.defaultCreditLimit',
      type: 'number',
      defaultValue: 0,
      allowedScopes: ['ORGANIZATION', 'SHOP'],
      description: 'Limite de crédit par défaut accordée aux nouveaux clients (0 = illimité)',
      minVersion: 1,
    });

    // Reçus
    this.register({
      key: 'receipts.autoPrint',
      type: 'boolean',
      defaultValue: false,
      allowedScopes: ['SHOP', 'USER', 'DEVICE'],
      description: 'Impression automatique des reçus après validation de vente',
      minVersion: 1,
    });

    // Sync & Sécurité
    this.register({
      key: 'sync.enabled',
      type: 'boolean',
      defaultValue: true,
      allowedScopes: ['PLATFORM', 'ORGANIZATION', 'SHOP'],
      description: 'Activer la synchronisation cloud',
      minVersion: 1,
    });
    this.register({
      key: 'security.autoLockMinutes',
      type: 'number',
      defaultValue: 5,
      allowedScopes: ['ORGANIZATION', 'SHOP', 'USER', 'DEVICE'],
      description: 'Délai d\'inactivité avant verrouillage automatique (minutes)',
      minVersion: 1,
    });
  }

  register(definition: SettingDefinition) {
    this.registry.set(definition.key, definition);
  }

  getDefinition(key: string): SettingDefinition | undefined {
    return this.registry.get(key);
  }

  getAllDefinitions(): SettingDefinition[] {
    return Array.from(this.registry.values());
  }

  validateValue(key: string, value: any): { valid: boolean; message?: string } {
    const def = this.getDefinition(key);
    if (!def) {
      return { valid: false, message: `Clé de paramètre inconnue: ${key}` };
    }

    if (def.type === 'boolean' && typeof value !== 'boolean') {
      return { valid: false, message: `${key} doit être un booléen` };
    }
    if (def.type === 'number' && typeof value !== 'number') {
      return { valid: false, message: `${key} doit être un nombre` };
    }
    if (def.type === 'enum' && def.allowedValues && !def.allowedValues.includes(value)) {
      return {
        valid: false,
        message: `${key} doit être l'une des valeurs : ${def.allowedValues.join(', ')}`,
      };
    }

    return { valid: true };
  }
}
