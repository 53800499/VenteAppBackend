# Stratégie de Tests du Backend

Ce document détaille les pratiques de test automatisé implémentées sur le backend NestJS.

---

## 1. Pyramide des Tests

```text
       /\
      /  \     Tests E2E (Supertest + Base de Test Réelle)
     /────\
    /      \    Tests d'Intégration (Controllers + Services + Mocks Supabase)
   /────────\
  /          \  Tests Unitaires Purs (Services Métier & Formules Mathématiques)
 /────────────\
```

---

## 2. Commandes d'Exécution des Tests

```bash
# Lancer tous les tests unitaires
npm run test

# Lancer les tests en mode surveillance (watch)
npm run test:watch

# Générer le rapport de couverture de code
npm run test:cov

# Lancer les tests de bout en bout (End-to-End)
npm run test:e2e
```

---

## 3. Exemple de Test Unitaire de Calcul Financier (`cash-sessions.service.spec.ts`)

```typescript
describe('CashSessionsService - Formules de calcul', () => {
  it('doit calculer un écart de 0 F lorsque le réel est égal au théorique', () => {
    const openingCash = 25000;
    const cashSales = 120000;
    const cashDrops = 50000;
    const expected = openingCash + cashSales - cashDrops; // 95 000 F
    const actual = 95000;
    const discrepancy = actual - expected;

    expect(discrepancy).toBe(0);
  });

  it('doit détecter un déficit lorsque le montant physique est inférieur', () => {
    const expected = 95000;
    const actual = 90000;
    const discrepancy = actual - expected;

    expect(discrepancy).toBe(-5000);
  });
});
```

