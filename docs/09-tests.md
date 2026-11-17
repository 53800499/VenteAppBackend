# Stratégie & Plan Global d'Assurance Qualité (QA & Tests) — VenteApp (ARIKE)

---

## 1. Pyramide des Tests & Objectifs de Couverture

La stratégie d'assurance qualité de **VenteApp (ARIKE)** applique rigoureusement le modèle de la **Pyramide de Tests** pour garantir une fiabilité mathématique et comptable absolue, particulièrement sur les flux financiers, le calcul des stocks et la réconciliation hors-ligne.

```
                   /\
                  /  \     Tests E2E & Recette Métier (10%)
                 /----\    • Scénarios complets de vente hors-ligne
                /      \   • Clôtures de caisse et réconciliation
               /--------\  Tests d'Intégration (20%)
              /          \ • Repositories Drift en mémoire, RLS Supabase
             /------------\ Tests Unitaires (70%)
            /              \ • BLoCs, Services de calcul, Validations DTO
           /────────────────\
```

### 1.1 Objectifs de Couverture de Code
- **Domaine Financier & Stocks (Ventes, Dettes, Caisse, Mouvements)** : **`> 90%` de couverture**.
- **Logique d'Authentification, Sécurité & RBAC** : **`> 85%` de couverture**.
- **Moteur de Synchronisation & Résolution de Conflits** : **`> 95%` de couverture**.

---

## 2. Stratégie de Test Mobile (Flutter / Dart)

### 2.1 Tests Unitaires des BLoCs (`bloc_test`)
Chaque BLoC est testé de façon déterministe pour valider l'émission ordonnée des états en réponse aux événements.

```dart
// Test de création de vente standard
blocTest<SalesBloc, SalesState>(
  'émet [SaleSubmittingState, SaleSuccessState] lorsque SubmitSaleEvent est validé',
  build: () {
    when(() => mockSalesRepository.createSale(any()))
        .thenAnswer((_) async => sampleSale);
    return SalesBloc(salesRepository: mockSalesRepository);
  },
  act: (bloc) => bloc.add(SubmitSaleEvent(sale: sampleSale)),
  expect: () => [
    isA<SaleSubmittingState>(),
    isA<SaleSuccessState>(),
  ],
);
```

### 2.2 Tests de Persistance SQLite Drift (Base en Mémoire)
Les requêtes SQL, triggers et transactions locales sont validés sans fichier disque persistant grâce à `NativeDatabase.memory()`.

```dart
test('La validation d\'une vente décrémente automatiquement le stock via trigger', () async {
  final db = AppDatabase(NativeDatabase.memory());
  
  // 1. Insertion produit initial (stock = 10)
  await db.into(db.productsTable).insert(
    ProductsTableCompanion.insert(name: 'Riz 25kg', priceSell: 15000, quantityInStock: 10),
  );

  // 2. Enregistrement d'une vente de 3 unités
  await db.createSaleTransaction(productId: 1, quantity: 3);

  // 3. Vérification du stock restant (attendu: 7)
  final product = await (db.select(db.productsTable)..where((p) => p.id.equals(1))).getSingle();
  expect(product.quantityInStock, equals(7));
});
```

---

## 3. Stratégie de Test Backend (NestJS / Jest)

### 3.1 Tests Unitaires des Services Métier
Vérification des règles d'intégrité comptable (interdiction de montants négatifs, validation de la cohérence `amount_paid + amount_credit = total_amount`).

### 3.2 Tests d'Intégration d'API (Supertest) & Idempotence
```typescript
describe('POST /api/v1/sales (Idempotency & Isolation)', () => {
  it('doit renvoyer la même réponse sans créer de doublon si la même Idempotency-Key est renvoyée', async () => {
    const payload = { ...sampleSaleDto };
    const idempotencyKey = 'key-test-uuid-12345';

    // Premier appel
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Idempotency-Key', idempotencyKey)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(payload)
      .expect(201);

    // Deuxième appel avec la même clé
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/sales')
      .set('Idempotency-Key', idempotencyKey)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(payload)
      .expect(201);

    expect(res1.body.data.id).toEqual(res2.body.data.id);
  });
});
```

---

## 4. Cahier de Recette Fonctionnelle & Scénarios Critiques

### Scénario 1 : Vente Hors-Ligne & Génération de Reçu WhatsApp
- **Objectif** : Valider l'exécution d'une vente complète sans aucune connexion réseau active.
- **Protocole** :
  1. Activer le **Mode Avion** sur le smartphone.
  2. Ouvrir l'application VenteApp et déverrouiller par code PIN.
  3. Ajouter 2 sacs de riz (15 000 F/unité) et 1 carton de lait (12 000 F).
  4. Appliquer une remise globale de 2 000 F (Total net : 40 000 F).
  5. Sélectionner le paiement en Espèces : saisir 50 000 F reçus.
  6. Valider la vente.
- **Résultats Attendus** :
  - La monnaie de 10 000 F s'affiche en grand écran en moins de 100 ms.
  - Le stock des deux produits est décrémenté immédiatement en local.
  - Le reçu `REC-YYYYMMDD-NNNN` est généré avec bouton direct WhatsApp.
  - Une ligne est insérée dans `sync_queue` avec le statut `pending`.

---

### Scénario 2 : Résolution Additive des Conflits de Remboursement de Dette
- **Objectif** : Vérifier que deux remboursements saisis hors-ligne sur deux appareils distincts ne s'écrasent pas.
- **Protocole** :
  1. Soit une dette initiale de 20 000 FCFA pour le client *Koffi*.
  2. Le Vendeur (Appareil A hors-ligne) enregistre un acompte de 6 000 F.
  3. Le Patron (Appareil B hors-ligne) enregistre un acompte de 4 000 F.
  4. Reconnecter les deux appareils à Internet.
  5. Déclencher la synchronisation.
- **Résultats Attendus** :
  - Le serveur Supabase applique les deux deltas de manière cumulative.
  - Le solde restant dû final de la dette est exactement de **10 000 FCFA** (et non 14 000 F ou 16 000 F).
  - Deux lignes distinctes sont enregistrées dans `debt_payments`.
  - **Zéro centime de perte financière constatée.**

---

### Scénario 3 : Annulation de Vente dans les 24h & Traçabilité Audit
- **Objectif** : Valider la restitution de stock et la consignation obligatoire de motif.
- **Protocole** :
  1. Vente #102 créée il y a 2 heures par un vendeur.
  2. Le Patron ouvre la fiche de la vente et sélectionne *"Annuler la vente"*.
  3. Tenter de valider sans saisir de motif $\rightarrow$ Vérifier le blocage `[ERR-VTE-03]`.
  4. Saisir le motif : *"Erreur de référence article - restitution client"*.
  5. Confirmer l'annulation.
- **Résultats Attendus** :
  - Le statut de la vente passe à `cancelled`.
  - Les quantités de tous les articles sont restituées à l'inventaire en temps réel.
  - Une entrée détaillée est générée dans `audit_logs` avec l'ancien et le nouvel état JSON.

---

### Scénario 4 : Cycle Complet de Session de Caisse & Contrôle d'Écart
- **Objectif** : Valider le calcul d'écart physique/théorique lors de la fermeture de caisse.
- **Protocole** :
  1. Ouvrir la caisse avec un fond initial de **20 000 FCFA**.
  2. Enregistrer 3 ventes en espèces pour un total de **75 000 FCFA**.
  3. Enregistrer une dépense d'achat de fournitures de **5 000 FCFA** payée en caisse.
  4. Théorique attendu : $20\,000 + 75\,000 - 5\,000 = 90\,000 \text{ FCFA}$.
  5. À la clôture, le caissier compte et saisit **88 000 FCFA** (déficit de 2 000 F).
- **Résultats Attendus** :
  - Le système calcule un écart de **-2 000 FCFA**.
  - L'application exige un commentaire obligatoire du caissier.
  - Le ticket Z de caisse mentionne l'écart et une alerte est transmise au Patron.

---

## 5. Automatisation & Pipeline CI/CD de Tests

```yaml
# Pipeline GitHub Actions / CI
name: Assurance Qualité VenteApp
on: [push, pull_request]

jobs:
  test-mobile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.29.x'
      - run: flutter pub get
      - run: flutter analyze
      - run: flutter test --coverage

  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:cov
      - run: npm run test:e2e
```
