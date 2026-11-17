# Architecture Technique Globale — VenteApp (ARIKE)

---

## 1. Vue d'Ensemble & Principes Directeurs

Le système **VenteApp (ARIKE)** repose sur une architecture **3-Tiers Offline-First & Multi-Plateforme**, combinant l'extrême réactivité d'une base embarquée locale sur mobile avec la puissance et l'extensibilité d'un backend cloud multi-tenant et d'un portail web de gestion.

```mermaid
graph TB
    subgraph Client_Tier ["1. COUCHE CLIENT (Edge / Point de Vente)"]
        Mobile["📱 Mobile App (Flutter / Dart)<br/>• Offline-First 100% Autonome<br/>• Base Locale SQLite (Drift)<br/>• BLoC State Management<br/>• Sync Queue FIFO (Background Isolate)"]
        WebAdmin["💻 Back-Office Web (Next.js 15 / React)<br/>• Dashboard Analytique & Supervision<br/>• Pilotage Multi-Boutiques<br/>• Gestion SaaS / Abonnements"]
    end

    subgraph Service_Tier ["2. COUCHE SERVICES (Backend Cloud)"]
        NestApp["⚙️ Backend API (NestJS / TypeScript)<br/>• Architecture Modulaire DDD<br/>• Middleware d'Idempotence<br/>• RBAC & Tenant Resolution Guards<br/>• Event-Driven Processing"]
    end

    subgraph Data_Tier ["3. COUCHE PERSISTANCE & SÉCURITÉ (Cloud DB)"]
        Supabase["🗄️ PostgreSQL (Supabase Cluster)<br/>• Row Level Security (RLS Multi-Tenant)<br/>• PgBouncer Connection Pooling<br/>• Triggers d'Intégrité & Audit Cloud"]
    end

    Mobile -- "1. Transactions Locales (0ms)" --> Mobile
    Mobile -- "2. Sync Asynchrone HTTPS/TLS 1.3" --> NestApp
    WebAdmin -- "REST API / SSR" --> NestApp
    NestApp -- "Pooled SQL Queries" --> Supabase
```

---

## 2. Diagrammes d'Architecture C4

### 2.1 Diagramme de Contexte (Niveau 1)
```mermaid
C4Context
    title Diagramme de Contexte Système — VenteApp (ARIKE)

    Person(vendeur, "Vendeur / Caissier", "Enregistre les ventes, encaissements et ouvertures/clôtures de caisse.")
    Person(patron, "Patron / Gérant", "Supervise les boutiques, consulte l'audit, gère les prix et les dettes.")
    Person(superadmin, "Super Administrateur", "Pilote la plateforme SaaS, les tenants et les abonnements.")

    System(venteapp_mobile, "VenteApp Mobile (Flutter)", "Application mobile Android/iOS fonctionnant 100% hors-ligne.")
    System(venteapp_web, "VenteApp Back-Office (Next.js)", "Console web de gestion et supervision multi-boutiques.")
    System(venteapp_api, "API Backend (NestJS)", "Serveur applicatif assurant la logique métier cloud et la synchronisation.")

    System_Ext(whatsapp, "Réseau WhatsApp", "Partage direct de reçus et messages de relance de créances.")
    System_Ext(printer, "Imprimante Bluetooth", "Impression des tickets de caisse thermiques 58mm/80mm.")
    System_Ext(supabase, "Cloud PostgreSQL (Supabase)", "Stockage sécurisé, RLS et authentification centrale.")

    Rel(vendeur, venteapp_mobile, "Utilise quotidiennement sur smartphone")
    Rel(patron, venteapp_mobile, "Pilote sa boutique")
    Rel(patron, venteapp_web, "Analyse les rapports consolidés")
    Rel(superadmin, venteapp_web, "Supervise la plateforme")

    Rel(venteapp_mobile, whatsapp, "Partage reçus & rappels", "URL Scheme")
    Rel(venteapp_mobile, printer, "Imprime tickets", "Bluetooth ESC/POS")
    Rel(venteapp_mobile, venteapp_api, "Synchronise les données (différé)", "HTTPS / JSON")
    Rel(venteapp_web, venteapp_api, "Consomme les API REST", "HTTPS / JSON")
    Rel(venteapp_api, supabase, "Lit et écrit avec RLS", "PostgreSQL TCP")
```

### 2.2 Diagramme de Conteneurs (Niveau 2)
```mermaid
C4Container
    title Diagramme de Conteneurs — VenteApp

    Container(app_flutter, "Mobile App", "Flutter / Dart", "Interface utilisateur réactive, BLoC, SQLite chiffré avec Drift, Isolate de sync d'arrière-plan.")
    Container(app_nextjs, "Web Back-Office", "Next.js 15, React 19, Tailwind", "Portail d'administration multi-tenant, TanStack Query, Zustand, ApexCharts.")
    Container(api_nestjs, "Backend API", "NestJS, Node.js 20+", "API REST modulaire, validation DTO, JWT/RBAC, Middleware d'idempotence.")
    ContainerDb(sqlite_db, "Base SQLite Locale", "SQLite3 / Drift", "Stockage local ACID, réplique locale intégrale des données de la boutique.")
    ContainerDb(pg_db, "Base Centrale", "PostgreSQL / Supabase", "Persistance multi-tenant avec RLS, audit trail immuable et files d'attente.")

    Rel(app_flutter, sqlite_db, "Lectures / Écritures synchrones (0ms)", "Drift ORM")
    Rel(app_flutter, api_nestjs, "Push / Pull via file d'attente", "REST HTTPS / JWT")
    Rel(app_nextjs, api_nestjs, "Requêtes d'administration & Analytics", "REST HTTPS / JWT")
    Rel(api_nestjs, pg_db, "Requêtes paramétrées", "Postgres Driver")
```

---

## 3. Architecture Mobile (Flutter Offline-First)

### 3.1 Découpage Logiciel & Clean Architecture
L'application Flutter est structurée selon les principes de la **Clean Architecture** et du **Domain-Driven Design (DDD)** :

```
lib/
├── app/                  # Configuration racine, thèmes, injection de dépendances (GetIt)
├── core/                 # Briques transversales non liées au métier
│   ├── database/         # Schéma Drift, migrations, DAOs, connexions chiffrées
│   ├── network/          # Client Dio, intercepteurs JWT, détection réseau
│   ├── security/         # Chiffrement AES-GCM, PBKDF2, stockage sécurisé
│   ├── sync/             # Moteur de synchronisation, gestionnaire de queue FIFO
│   └── errors/           # Exceptions typées et échecs applicatifs
├── features/             # Modules métier verticaux (Feature-First)
│   ├── auth/             # BLoC, pages PIN/Biométrie, repositories
│   ├── dashboard/        # Widgets KPI temps réel
│   ├── inventory/        # Catalogue, fiches produits, ajustements, lots
│   ├── sales/            # Panier standard, vente rapide, scan code-barres
│   ├── debts/            # Créances, acomptes, pardon de dette, relances
│   ├── cash_sessions/    # Ouverture/clôture caisse, contrôle d'écarts
│   ├── expenses/         # Saisie des charges et justificatifs photo
│   ├── stock_transfer/   # Expéditions et réceptions inter-boutiques
│   ├── procurement/      # Commandes et réceptions fournisseurs
│   ├── fx_exchange/      # Bureau de change et taux de session
│   ├── audit/            # Consultation du journal d'audit
│   └── settings/         # Configuration, sauvegardes, profils
└── shared/               # Widgets réutilisables, composants graphiques, formatters
```

### 3.2 Modèle de Gestion d'État (BLoC / Cubit)
Le pattern **BLoC (Business Logic Component)** garantit une séparation stricte entre l'interface utilisateur et la logique métier :
- **Events** : Événements utilisateurs immuables émis depuis la vue (ex: `AddProductToCartEvent`, `SubmitPaymentEvent`, `ForgiveDebtEvent`).
- **States** : États d'interface émis de façon unidirectionnelle (ex: `CartStateLoaded`, `SaleProcessingState`, `SaleSuccessState`).
- **BlocObserver** : Observateur global pour le monitoring et la traçabilité des erreurs d'état en temps réel.

```mermaid
graph LR
    UI[UI Widgets Flutter] -- 1. Envoie Event --> Bloc[Feature BLoC / Cubit]
    Bloc -- 2. Exécute Transaction --> Repo[Repository Local]
    Repo -- 3. Écrit dans Drift --> SQLite[(SQLite Local)]
    Repo -- 4. Enfile Sync Event --> Queue[(sync_queue Table)]
    Bloc -- 5. Émet Nouvel État --> UI
```

---

## 4. Architecture Backend (NestJS Multi-Tenant)

### 4.1 Modularité & Inversion de Contrôle
Le serveur Backend est développé en **NestJS (TypeScript)** selon une architecture hautement modulaire. Chaque domaine métier est encapsulé dans son propre module (`Controller`, `Service`, `Repository`, `DTOs`).

```
src/
├── core/                 # Infrastructure transverse
│   ├── database/         # Client Supabase/PostgreSQL avec RLS
│   ├── security/         # JWT Strategy, Refresh Tokens, RBAC Guards
│   ├── idempotency/      # Idempotency Middleware (clé unique)
│   ├── cache/            # Cache mémoire et invalidation d'événements
│   └── monitoring/       # Intercepteurs de logging structuré et métriques
├── modules/              # Modules métier verticaux
│   ├── auth/             # Authentification JWT, PIN, WhatsApp OTP
│   ├── tenants/          # Gestion hermétique des organisations
│   ├── shops/            # Boutiques et affectations utilisateurs
│   ├── users/            # Gestion des comptes et profils
│   ├── rbac/             # Gestion fine des rôles et permissions
│   ├── inventory/        # Catalogue, lots et mouvements de stock
│   ├── sales/            # Enregistrement, annulation et remplacements
│   ├── payments/         # Traitement des encaissements
│   ├── debts/            # Suivi des créances et remboursements
│   ├── cash-sessions/    # Gestion des sessions et clôtures de caisse
│   ├── expenses/         # Charges d'exploitation
│   ├── procurement/      # Achats et réceptions fournisseurs
│   ├── stock-transfers/  # Transferts inter-boutiques
│   ├── fx-exchange/      # Bureau de change et taux
│   ├── calculators/      # Simulateurs commerciaux
│   ├── reports/          # Rapports financiers consolidés
│   ├── audit/            # Journal d'audit centralisé
│   └── licensing/        # Licences SaaS et abonnements
└── main.ts               # Point d'entrée, Swagger, validation globale
```

### 4.2 Middleware d'Idempotence
Pour éviter tout risque de double transaction lors de renvois réseau automatiques, le middleware d'idempotence vérifie le header `Idempotency-Key` :
- Si la clé est déjà connue pour le même tenant, la réponse mise en cache est immédiatement retournée sans réexécuter l'action en base.
- Si la clé est nouvelle, la transaction s'exécute et le résultat est persisté dans `idempotency_records`.

---

## 5. Moteur de Synchronisation Cloud & Résolution des Conflits

### 5.1 Pipeline de Synchronisation en 3 Étapes
La synchronisation repose sur un modèle **Push/Pull asynchrone non-bloquant** :

```mermaid
sequenceDiagram
    autonumber
    participant UI as Thread UI Mobile
    participant LocalDB as SQLite (Drift)
    participant SyncWorker as Background Isolate (Worker)
    participant API as Backend NestJS
    participant CloudDB as PostgreSQL (Supabase)

    UI->>LocalDB: 1. INSERT Transaction (Vente/Dette)
    LocalDB->>LocalDB: 2. INSERT dans sync_queue (status: 'pending')
    LocalDB-->>UI: Confirmation immédiate (0 ms)
    
    Note over SyncWorker: Détection connexion Internet
    SyncWorker->>LocalDB: 3. Lecture FIFO des éléments 'pending'
    SyncWorker->>API: 4. POST /api/v1/sync/push (Payloads batchés)
    API->>CloudDB: 5. Application des deltas avec vérification version
    CloudDB-->>API: Succès / Conflits
    API-->>SyncWorker: 6. Confirmation avec nouveaux server_ids
    SyncWorker->>LocalDB: 7. UPDATE sync_queue SET status='done'
    SyncWorker->>LocalDB: 8. UPDATE entités locales (synced_at, version)
```

### 5.2 Stratégie Différenciée de Résolution des Conflits

| Type de Donnée | Stratégie Appliquée | Règle de Résolution | Justification Métier |
| :--- | :---: | :--- | :--- |
| **Données Financières**<br/>*(Remboursements dettes, acomptes, règlements)* | **Fusion Additive (Delta-Event)** | Le serveur rejoue chaque paiement individuellement : les montants sont cumulés, le solde restant est recalculé comme la somme des deltas. | **Zéro perte d'argent** : si patron et vendeur enregistrent chacun 5 000 F d'acompte hors-ligne, 10 000 F sont comptabilisés. |
| **Mouvements de Stock**<br/>*(Ventes, réapprovisionnements, pertes)* | **Journal Append-Only** | Chaque mouvement est inséré avec son delta (+/- Qty). La quantité finale correspond à la somme arithmétique de tous les mouvements. | Prévient l'écrasement d'une vente par une entrée en stock concurrente. |
| **Données Descriptives**<br/>*(Nom produit, seuil alerte, note client)* | **Last-Write-Wins (LWW)** | La version ayant le timestamp `updated_at` le plus récent l'emporte. | Les métadonnées textuelles ne présentent pas de risque comptable critique. |
| **Conflits Ambigus / Prix**<br/>*(Modification contradictoire d'un tarif)* | **Arbitrage Manuel (Patron)** | La ligne passe en `sync_status = 'conflict'`. Un écran dédié sur le mobile du Patron affiche les deux versions côte à côte. | Le Patron conserve le contrôle souverain sur sa politique tarifaire. |

---

## 6. Architecture de Sécurité, Chiffrement & Isolation

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   DISPOSITIF DE SÉCURITÉ MULTI-NIVEAUX                   │
├─────────────────────────┬────────────────────────────────────────────────┤
│ 🔐 Chiffrement au Repos │ Base locale SQLite chiffrée via SQLCipher.     │
│    (Mobile)             │ Sauvegardes .venteapp chiffrées en AES-256-GCM.│
├─────────────────────────┼────────────────────────────────────────────────┤
│ 🛡️ Hachage des Secrets  │ Code PIN haché avec bcrypt (coût 10).          │
│                         │ Clés stockées dans flutter_secure_storage.     │
├─────────────────────────┼────────────────────────────────────────────────┤
│ 🌐 Chiffrement Transit  │ Toutes communications en HTTPS / TLS 1.3.      │
│                         │ Headers d'autorisation Bearer JWT signés SHA256│
├─────────────────────────┼────────────────────────────────────────────────┤
│ 🏢 Isolation Cloud      │ PostgreSQL Row Level Security (RLS) :          │
│    (Multi-Tenant)       │ Chaque requête est bornée à `tenant_id`        │
│                         │ et `shop_id` sans fuite de données possible.   │
├─────────────────────────┼────────────────────────────────────────────────┤
│ 📜 Immutabilité Audit   │ Journal d'audit `audit_logs` en mode lecture/  │
│                         │ insertion seule (aucun UPDATE/DELETE permis).  │
└─────────────────────────┴────────────────────────────────────────────────┘
```

---

## 7. Architecture Web Back-Office (Next.js 15)

Le portail de supervision est développé avec **Next.js 15 (App Router)** et **React 19** :
- **Server-Side Rendering (SSR) & Server Components** : Chargement ultra-rapide des tableaux de bord initiaux.
- **Client Components & TanStack Query (v5)** : Mises à jour en temps réel des données de caisse, invalidation granulaire du cache et requêtes optimisées.
- **Zustand** : Gestion centralisée de l'état de navigation, de la boutique active sélectionnée et de la session utilisateur.
- **Tailwind CSS & ApexCharts** : Design responsive adapté aux écrans d'ordinateur de bureau, tablettes et ordinateurs portables, avec graphiques d'analyse financière interactifs.
