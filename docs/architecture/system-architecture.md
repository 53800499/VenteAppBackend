# Architecture Système Détaillée du Backend

Ce document décrit l'organisation interne du backend NestJS d'ARIKE, l'agencement des couches logicielles et l'intégration avec les services tiers.

---

## 1. Vue d'Ensemble des Couches Logicielles

Le backend est structuré en 4 couches d'abstraction distinctes :

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        1. COUCHE D'ENTRÉE (HTTP API)                   │
│   Controllers REST • Décorateurs (@CurrentUser) • Pipes de Validation │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                  2. COUCHE DE CONTRÔLE D'ACCÈS & SÉCURITÉ               │
│   JwtAuthGuard • TenantGuard • ShopGuard • PermissionsGuard / RBAC     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                     3. COUCHE MÉTIER & DOMAINE (SERVICES)              │
│   SalesService • CashSessionsService • InventoryService • SyncService │
│   Bus Événementiel (@nestjs/event-emitter)                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    4. COUCHE INFRASTRUCTURE & PERSISTANCE              │
│   Client Supabase PostgreSQL • Migrations SQL • Agrégateurs MoMo       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Découpage des 28 Modules Métier

Chaque module métier situé dans `src/modules/` est autonome et encapsule :
- Son contrôleur HTTP exposant les endpoints REST documentés via Swagger.
- Son service métier contenant les règles de gestion (calculs financiers, vérifications de stock, déductions de solde).
- Ses DTOs (Data Transfer Objects) validés par `class-validator`.

### Liste des Domaines :
1. **Administration & Identité** : `admin`, `identity`, `tenants`, `shops`, `users`, `rbac`, `auth`.
2. **Gestion Commerciale** : `sales`, `sales-orders`, `sales-analysis`, `customers`, `debts`.
3. **Logistique & Stocks** : `inventory`, `purchases`, `stock-transfers`.
4. **Trésorerie & Comptabilité** : `cash-sessions`, `expenses`, `calculators`, `fx-exchange`.
5. **Plateforme & Distribution** : `licensing`, `subscription`, `payments`, `app-updates`, `notifications`, `audit`, `reports`.

