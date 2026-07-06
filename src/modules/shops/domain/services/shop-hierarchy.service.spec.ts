import { Shop } from '../entities/shop.entity';
import { ShopHierarchyService } from './shop-hierarchy.service';

describe('ShopHierarchyService', () => {
  const service = new ShopHierarchyService();

  const shops = [
    new Shop(1, 'Principale', null, null, 10, true, true, 1000, null),
    new Shop(2, 'Annexe A', null, null, 10, true, false, 2000, 1),
    new Shop(3, 'Annexe B', null, null, 10, true, false, 3000, 1),
    new Shop(4, 'Autre réseau', null, null, 10, true, false, 4000, null),
    new Shop(5, 'Filiale autre', null, null, 10, true, false, 5000, 4),
  ];

  it('résout la racine depuis une sous-boutique', () => {
    expect(service.resolveRootShopId(shops, 2)).toBe(1);
    expect(service.resolveRootShopId(shops, 5)).toBe(4);
  });

  it('retourne uniquement le réseau de la boutique active', () => {
    const group = service.shopsInGroup(shops, 2);
    expect(group.map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it('isole les réseaux indépendants', () => {
    const group = service.shopsInGroup(shops, 5);
    expect(group.map((s) => s.id)).toEqual([4, 5]);
  });
});
