# Documentation Technique & Métier Backend — ARIKE (VenteApp)

Bienvenue dans la documentation officielle et exhaustive du système backend de **ARIKE** (VenteApp), la plateforme de gestion commerciale, financière et d'inventaire hors-ligne (Offline-First) conçue pour les commerçants et PME d'Afrique de l'Ouest (Bénin, Togo, Côte d'Ivoire, Sénégal, etc.) et de l'espace UEMOA.

---

## 1. Vue d'Ensemble & Objectifs du Backend

Le backend d'ARIKE est un **Monolithe Modulaire** haute performance développé avec **NestJS 11** et adossé à **PostgreSQL (via Supabase)**.

Il a été conçu pour répondre à plusieurs contraintes fondamentales :
1. **Offline-First & Résilience Réseau** : L'application mobile/desktop fonctionne 100% hors-ligne. Le backend sert de hub de synchronisation bidirectionnelle, gérant les deltas de modifications, les réconciliations et les conflits sans bloquer les opérations locales.
2. **Multi-Tenancy & Multi-Boutiques** : Un compte commerçant (Tenant) peut gérer plusieurs boutiques (points de vente physiques ou entrepôts) avec isolation stricte des données et gestion hiérarchique des droits.
3. **Sécurité Financière & Audit** : Contrôle strict des sessions de caisse, validation des écarts financiers avec PIN gérant, journalisation inaltérable des événements d'audit (vols, suppressions, modifications sensibles).
4. **Écosystème Financier Africain** : Prise en charge native du Franc CFA (XOF), du Mobile Money (MTN MoMo, Moov Money, Wave, Celtiis via FedaPay / CinetPay), et des relances de dettes par WhatsApp.

---

## 2. Table des Matières de la Documentation Backend

### 2.1 Guides Généraux, Règles Métier & Mises à Jour
- **[01-architecture-globale.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/01-architecture-globale.md)** : Architecture NestJS, Clean Architecture, cycle de vie des requêtes, Pipes, Guards, Interceptors.
- **[02-base-de-donnees-et-schema.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/02-base-de-donnees-et-schema.md)** : Schéma relationnel PostgreSQL (59 migrations), tables clés, contraintes d'intégrité, RLS, index.
- **[03-catalogue-api-endpoints.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/03-catalogue-api-endpoints.md)** : Référentiel exhaustif des 28 modules et de leurs endpoints HTTP avec payloads DTO et réponses.
- **[04-securite-authentification-rbac.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/04-securite-authentification-rbac.md)** : JWT, Refresh Tokens, sessions appareils, matrice des permissions, validation PIN gérant.
- **[05-moteur-synchronisation-offline-first.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/05-moteur-synchronisation-offline-first.md)** : Protocole de sync bidirectionnelle, deltas par horodatage, traitement par lots, résolution de conflits.
- **[06-gestion-financiere-caisses-et-dettes.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/06-gestion-financiere-caisses-et-dettes.md)** : Cycle complet des sessions de caisse (ouverture, clôture, écarts, PIN), créances et recouvrements.
- **[07-abonnements-licences-et-paiements.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/07-abonnements-licences-et-paiements.md)** : Plans Free/Pro/Entreprise, passerelles Mobile Money, signature cryptographique des licences.
- **[08-deploiement-devops-et-maintenance.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/08-deploiement-devops-et-maintenance.md)** : Configuration des variables d'environnement, Docker, scripts de maintenance, mises à jour APK/EXE.
- **[09-guide-commandes-et-scripts.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/09-guide-commandes-et-scripts.md)** : **Toutes les commandes CLI et scripts** (npm, Docker, Supabase, Jest, publication d'APK).
- **[10-regles-et-logiques-metier-detaillees.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/10-regles-et-logiques-metier-detaillees.md)** : **Formules mathématiques & règles de gestion** (CMUP/PAMP, écarts de caisse, marges brutes, plafonds de crédit, licences Ed25519, devises FX).
- **[11-guide-deploiement-et-gestion-mises-a-jour.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/11-guide-deploiement-et-gestion-mises-a-jour.md)** : **Procédure de déploiement et de publication de mises à jour** (Supabase Storage, script `publish-update.js`, gestion des versions obligatoires et rollback).

### 2.2 Dossiers Spécialisés
- **Dossier `adr/` (Architecture Decision Records)** :
  - **[0001-choix-nestjs-modular-monolith.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/adr/0001-choix-nestjs-modular-monolith.md)**
  - **[0002-choix-postgresql-supabase-rls.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/adr/0002-choix-postgresql-supabase-rls.md)**
  - **[0003-protocole-synchronisation-offline-first.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/adr/0003-protocole-synchronisation-offline-first.md)**
- **Dossier `architecture/`** :
  - **[system-architecture.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/architecture/system-architecture.md)**
  - **[data-flow.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/architecture/data-flow.md)**
- **Dossier `database/`** :
  - **[schema-reference.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/database/schema-reference.md)**
  - **[migrations-guide.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/database/migrations-guide.md)**
- **Dossier `deployment/`** :
  - **[docker-deployment.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/deployment/docker-deployment.md)**
  - **[ci-cd-pipeline.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/deployment/ci-cd-pipeline.md)**
- **Dossier `operations/`** :
  - **[monitoring-and-logging.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/operations/monitoring-and-logging.md)**
  - **[backup-and-disaster-recovery.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/operations/backup-and-disaster-recovery.md)**
- **Dossier `security/`** :
  - **[threat-model-and-hardening.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/security/threat-model-and-hardening.md)**
  - **[rbac-and-audit.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/security/rbac-and-audit.md)**
- **Dossier `testing/`** :
  - **[testing-strategy.md](file:///c:/Sikirou/eskay/VenteApp/backend/docs/testing/testing-strategy.md)**

---

## 3. Démarrage Rapide en Local

```bash
cd backend
npm install
cp .env.example .env
npm run start:dev
```
API REST : `http://localhost:3000/api/v1` | Swagger : `http://localhost:3000/api/docs`
