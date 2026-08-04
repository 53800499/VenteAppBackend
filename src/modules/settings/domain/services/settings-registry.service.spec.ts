import { SettingsRegistryService } from './settings-registry.service';
import { SettingsScopeResolverService } from './settings-scope-resolver.service';

describe('SettingsRegistry & ScopeResolver', () => {
  let registry: SettingsRegistryService;
  let resolver: SettingsScopeResolverService;

  beforeEach(() => {
    registry = new SettingsRegistryService();
    resolver = new SettingsScopeResolverService(registry);
  });

  it('should register default keys', () => {
    const def = registry.getDefinition('sales.allowCredit');
    expect(def).toBeDefined();
    expect(def?.defaultValue).toBe(true);
  });

  it('should validate setting values correctly', () => {
    expect(registry.validateValue('sales.allowCredit', true).valid).toBe(true);
    expect(registry.validateValue('sales.allowCredit', 'invalid').valid).toBe(false);
    expect(registry.validateValue('inventory.negativeStockMode', 'DENY').valid).toBe(true);
    expect(registry.validateValue('inventory.negativeStockMode', 'INVALID').valid).toBe(false);
  });

  it('should resolve hierarchical effective snapshot with shop overrides', () => {
    const snapshot = resolver.resolveEffectiveSnapshot({
      shopId: 'shop-123',
      shopSettings: {
        'company.name': 'Boutique Cotonou',
        'sales.allowCredit': false,
        'inventory.negativeStockMode': 'DENY',
      },
      version: 5,
    });

    expect(snapshot.version).toBe(5);
    expect(snapshot.scopeId).toBe('shop-123');
    expect(snapshot.settings.company.name).toBe('Boutique Cotonou');
    expect(snapshot.settings.sales.allowCredit).toBe(false);
    expect(snapshot.settings.inventory.negativeStockMode).toBe('DENY');
  });
});
