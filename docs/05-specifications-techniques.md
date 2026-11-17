# Spécifications Techniques Détaillées — VenteApp (ARIKE)

---

## 1. Stack Technologique & Versions Logicielles

### 1.1 Composants Logiciels de Référence

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SOCLE TECHNOLOGIQUE UNIFIÉ                           │
├─────────────────────┬──────────────────────┬───────────────────────────┤
│ Couche / Composant  │ Technologie Retenue  │ Version / Spécification   │
├─────────────────────┼──────────────────────┼───────────────────────────┤
│ **Mobile Client**   │ **Flutter / Dart**   │ Flutter 3.29+ / Dart 3.7+ │
│ **ORM Mobile Local**│ **Drift (SQLite)**   │ Drift v2.34.0+ (sqlite3mc)│
│ **Gestion d'État**  │ **flutter_bloc**     │ v9.1.0 (BLoC / Cubit)     │
│ **Backend Server**  │ **NestJS**           │ NestJS v11.0.1+ (Node 20+)│
│ **Langage Backend** │ **TypeScript**       │ TypeScript v5.7+          │
│ **Base Cloud**      │ **PostgreSQL**       │ v15+ (Cluster Supabase)   │
│ **Portail Web**     │ **Next.js / React**  │ Next.js 15.1+ / React 19  │
│ **State Web**       │ **Zustand & Query**  │ Zustand 5.0+ / TanStack 5 │
│ **Styling Web**     │ **Tailwind CSS**     │ Tailwind CSS v4.0+        │
└─────────────────────┴──────────────────────┴───────────────────────────┘
```

---

## 2. Standards de Développement & Conventions

### 2.1 Conventions de Nommage Unifiées

| Élément | Mobile (Dart / Flutter) | Backend (NestJS / TS) | Base de Données (SQL) |
| :--- | :--- | :--- | :--- |
| **Fichiers** | `snake_case.dart` | `kebab-case.ts` | `snake_case.sql` |
| **Classes / Types** | `PascalCase` | `PascalCase` | — |
| **Variables / Fonctions**| `camelCase` | `camelCase` | `snake_case` |
| **Tables SQL** | `snake_case` (pluriel) | `snake_case` (pluriel) | `sales`, `debt_payments` |
| **Colonnes SQL** | `snake_case` | `camelCase` (mapped) | `created_at`, `shop_id` |
| **Constantes / Enums** | `lowerCamelCase` / Enum | `SCREAMING_SNAKE_CASE` | `VARCHAR / CHECK` |

### 2.2 Règles de Conception Logicielle
1. **Immutabilité des Objets de Domaine** : Toutes les entités et modèles de données Dart utilisent `Equatable` ou `freezed` pour garantir l'égalité structurelle et prévenir les effets de bord.
2. **Typage Strict** : Interdiction du type `any` en TypeScript et `dynamic` en Dart, sauf cas d'interfaçage dynamique expressément documenté.
3. **Gestion Déterministe des Montants** : Tous les calculs financiers sont effectués en **entiers stricts (INTEGER)** représentant des Francs CFA sans décimales.

---

## 3. Spécifications Techniques Mobile (Flutter)

### 3.1 Découpage des Couches par Feature (Clean Architecture)

Chaque fonctionnalité (`feature`) du dossier `lib/features/` respecte l'arborescence standardisée :

```
lib/features/sales/
├── data/
│   ├── datasources/
│   │   ├── sales_local_datasource.dart    # Requêtes Drift SQLite
│   │   └── sales_remote_datasource.dart   # Appels HTTP API (Dio)
│   ├── models/
│   │   └── sale_model.dart                # Mappings JSON / Drift <-> Domain
│   └── repositories/
│       └── sales_repository_impl.dart    # Implémentation du contrat de repository
├── domain/
│   ├── entities/
│   │   ├── sale.dart                      # Entité métier immuable
│   │   └── sale_item.dart
│   ├── repositories/
│   │   └── sales_repository.dart         # Interface abstraite
│   └── usecases/
│       ├── create_sale_usecase.dart       # Logique métier pure
│       └── cancel_sale_usecase.dart
└── presentation/
    ├── bloc/
    │   ├── sales_bloc.dart
    │   ├── sales_event.dart
    │   └── sales_state.dart
    ├── pages/
    │   ├── new_sale_page.dart
    │   └── sales_history_page.dart
    └── widgets/
        ├── cart_summary_widget.dart
        └── payment_selector_widget.dart
```

### 3.2 Moteur de Données Local : Drift ORM
Drift permet de combiner la rigueur du SQL relationnel avec la sécurité du typage Dart à la compilation :
- **Transactions Atomiques** : Les opérations composées (Vente + Lignes de vente + Décrément stock + Dette éventuelle) s'exécutent au sein d'un bloc `database.transaction(() async { ... })`.
- **Réactivité via Streams** : Drift génère des requêtes retournant des `Stream<List<Product>>`, permettant à l'interface Flutter de se mettre à jour automatiquement dès qu'un mouvement de stock ou une vente est validé.
- **Support du Chiffrement SQLite (sqlite3mc)** : Intégration transparente pour protéger les données en cas d'accès physique non autorisé à la mémoire du smartphone.

### 3.3 Isolate d'Arrière-Plan & Traitements Lourds
Pour maintenir un taux de rafraîchissement constant à **60 images par seconde**, les tâches consommatrices de CPU sont déléguées à un **Isolate Dart dédié** via `compute()` ou un worker de fond :
- Génération et rendu des documents PDF (factures, reçus, bilans financiers).
- Traitement par lots de la file de synchronisation (`sync_queue`).
- Export et déchiffrement des archives de sauvegarde `.venteapp`.

```dart
// Exemple de délégation de génération PDF à un Isolate
Future<Uint8List> generateReceiptPdfAsync(SaleReceiptData data) async {
  return await compute(_generatePdfTask, data);
}

Uint8List _generatePdfTask(SaleReceiptData data) {
  final pdf = pw.Document();
  // Construction du document PDF en mémoire isolée
  return pdf.save();
}
```

### 3.4 Périphériques & Intégrations Matérielles

```
┌────────────────────────────────────────────────────────────────────────┐
│                 PILOTAGE DU MATÉRIEL SUR LE CLIENT MOBILE             │
├─────────────────────┬──────────────────────┬───────────────────────────┤
│ Fonctionnalité      │ Package / API        │ Mode Opératoire           │
├─────────────────────┼──────────────────────┼───────────────────────────┤
│ **Scan Code-Barres**│ `mobile_scanner`     │ Détection temps réel 60fps│
│                     │                      │ Caméra arrière autofocus  │
├─────────────────────┼──────────────────────┼───────────────────────────┤
│ **Impression**      │ `printing`           │ Protocole ESC/POS         │
│ **Thermique**       │                      │ Bluetooth SPP / BLE       │
├─────────────────────┼──────────────────────┼───────────────────────────┤
│ **Authentification**│ `local_auth`         │ Biométrie Android / iOS   │
│ **Biométrique**     │                      │ (Empreinte / Face ID)     │
├─────────────────────┼──────────────────────┼───────────────────────────┤
│ **Saisie Vocale**   │ `speech_to_text`     │ Reconnaissance vocale     │
│                     │                      │ pour saisie rapide prix   │
├─────────────────────┼──────────────────────┼───────────────────────────┤
│ **Stockage Secret** │ `flutter_secure_`    │ Keychain iOS / Keystore   │
│                     │ `storage`            │ Android pour clés AES/PIN │
├─────────────────────┼──────────────────────┼───────────────────────────┤
│ **Notifications**   │ `flutter_local_`     │ AlarmManager / Channels   │
│ **Sonores & Fond**  │ `notifications`      │ Haute Importance + Son    │
└─────────────────────┴──────────────────────┴───────────────────────────┘
```

### 3.5 Moteur de Notifications Sonores & Planification Hors-Application
Pour assurer la délivrance des alertes critiques lorsque l'application est en arrière-plan ou fermée :
1. **Initialisation des Canaux Android à Haute Importance** :
   - Chaque canal (`venteapp_debt`, `venteapp_stock`, `venteapp_summary`, `venteapp_sync`) est déclaré avec `importance: Importance.high`, `priority: Priority.high`, `playSound: true` et `enableVibration: true`.
2. **Planification Locale Déterministe (`zonedSchedule`)** :
   - Le résumé journalier (20h00) et les rappels de dettes sont programmés via `tz.TZDateTime` et le réveil natif de l'OS (Android `AlarmManager` / iOS Notification Center).
   - L'alarme réveille le système pour afficher la bannière de notification et jouer la sonnerie d'alerte sans nécessiter l'ouverture préalable de l'application.
3. **Deep Linking au Clic** :
   - Le champ `payload` contient l'URI de redirection interne (ex: `/debts/detail?id=42`), résolu par le routeur Flutter dès l'appui sur la notification.

---

## 4. Spécifications Techniques Backend (NestJS)

### 4.1 Architecture en Couches & Cycle de Vie des Requêtes

Chaque requête HTTP adressée au backend traverse une chaîne de filtres, gardes et intercepteurs standardisée :

```mermaid
graph LR
    Req[Requête HTTP Entrante] --> Cors[CORS & Helmet Security]
    Cors --> Idemp[Middleware Idempotence]
    Idemp --> TenantGuard[Tenant & Shop Resolution Guard]
    TenantGuard --> AuthGuard[JWT Authentication Guard]
    AuthGuard --> RbacGuard[RBAC Permissions Guard]
    RbacGuard --> ValPipe[Validation Pipe class-validator]
    ValPipe --> Controller[NestJS Controller]
    Controller --> Service[Domain Business Service]
    Service --> Repo[Supabase / Postgres Client]
    Repo --> PostProc[Transform & Response Interceptor]
    PostProc --> Res[Réponse HTTP Formatée]
```

### 4.2 Pipeline d'Exécution & Gardes Sécurité

1. **`TenantGuard`** : Extrait l'en-tête `X-Tenant-ID` et `X-Shop-ID`, vérifie la validité du tenant et injecte le contexte dans la requête pour isoler les requêtes en base.
2. **`JwtAuthGuard`** : Valide le token JWT transmis dans le header `Authorization: Bearer <token>`, vérifie sa signature et extrait l'utilisateur actif.
3. **`RolesGuard / PermissionsGuard`** : Vérifie que le rôle de l'utilisateur détient la permission requise (ex: `sales.cancel`, `debts.forgive`, `audit.read`).
4. **`ValidationPipe`** : Valide la conformité du payload JSON entrant selon les DTOs TypeScript (décorateurs `@IsString()`, `@IsInt()`, `@Min()`, `@IsOptional()`).

### 4.3 Gestion de l'Idempotence
Pour sécuriser les transactions contre les doubles soumissions réseau :
```typescript
@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (!idempotencyKey || req.method === 'GET') {
      return next();
    }

    const existingRecord = await this.idempotencyService.find(idempotencyKey);
    if (existingRecord) {
      return res.status(existingRecord.statusCode).json(existingRecord.responseBody);
    }

    // Capture et persistance de la réponse après exécution
    next();
  }
}
```

---

## 5. Spécifications Techniques Web Back-Office (Next.js 15)

### 5.1 Architecture App Router & Rendu Hybride
- **Server Components (`app/`)** : Utilisés par défaut pour les layouts, les pages statiques et les composants nécessitant un préchargement direct des données de configuration.
- **Client Components (`"use client"`)** : Utilisés pour tous les formulaires interactifs, tableaux de données dynamiques avec filtres temps réel, graphiques de statistiques (ApexCharts) et sélecteurs de date/période.

### 5.2 Gestion de l'État & Requêtage (TanStack Query v5 & Zustand)
- **TanStack Query (React Query)** :
  - Mise en cache intelligente des réponses d'API avec invalidation automatique lors des mutations.
  - Stratégie `staleTime: 60_000` (1 minute) pour les rapports analytiques et `staleTime: 0` pour les sessions de caisse en direct.
- **Zustand Stores** :
  - `useAuthStore` : Stocke l'utilisateur authentifié, le token JWT et les permissions.
  - `useShopStore` : Gère la boutique couramment sélectionnée dans le sélecteur multi-boutiques.

---

## 6. Journalisation, Traçabilité & Observabilité

```
┌────────────────────────────────────────────────────────────────────────┐
│                  DISPOSITIF D'OBSERVABILITÉ SYSTÈME                    │
├─────────────────────┬──────────────────────────────────────────────────┤
│ **Logs Applicatifs**│ Format JSON structuré avec horodatage ISO-8601,  │
│                     │ niveau de sévérité (INFO, WARN, ERROR),         │
│                     │ tenant_id, correlation_id et stack trace.        │
├─────────────────────┼──────────────────────────────────────────────────┤
│ **Traçage Erreurs** │ Capture automatique des exceptions non gérées    │
│                     │ sur Mobile et Backend avec contexte utilisateur. │
├─────────────────────┼──────────────────────────────────────────────────┤
│ **Healthchecks**    │ Route `/health` sur le Backend vérifiant la      │
│                     │ connectivité à la base Supabase et la mémoire.   │
└─────────────────────┴──────────────────────────────────────────────────┘
```

---

## 7. Optimisations de Performance & Gestion de la Mémoire

1. **Virtualisation des Listes Mobiles** : Utilisation de `ListView.builder` avec pagination pour garantir une consommation mémoire constante, même avec des catalogues de plus de 10 000 articles.
2. **Indexation SQL Exhaustive** : Toutes les colonnes de filtrage fréquent (`shop_id`, `created_at`, `status`, `customer_id`, `is_deleted`) sont indexées en SQLite et PostgreSQL.
3. **Compression & Redimensionnement des Images** : Les photos d'articles et justificatifs de dépenses sont automatiquement compressées en format WebP / JPEG (largeur max 800px) avant enregistrement local ou téléversement cloud.
