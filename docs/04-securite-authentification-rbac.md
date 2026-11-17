# 04 — Sécurité, Authentification & Contrôle d'Accès (RBAC)

Ce document décrit en détail l'architecture de sécurité du backend de **ARIKE (VenteApp)** : cycle de vie des jetons, isolation multi-tenant, matrice des permissions (RBAC) et politique de supervision par code PIN.

---

## 1. Mécanismes d'Authentification

### 1.1 Jetons JWT (JSON Web Tokens)
L'authentification repose sur une architecture à double jeton :

1. **Access Token (Courte durée — 1 heure)** :
   - Signé avec l'algorithme `HS256` via `@nestjs/jwt`.
   - Contient l'identité de l'utilisateur, son `tenant_id`, son rôle principal et la liste de ses permissions effectives.
   - Doit être transmis dans chaque requête HTTP via le header `Authorization: Bearer <access_token>`.

2. **Refresh Token (Longue durée — 30 à 90 jours)** :
   - Stocké de manière chiffrée en base dans la table `refresh_tokens`.
   - Associé à une empreinte d'appareil unique (`device_fingerprint`).
   - Permet de renouveler silencieusement l'Access Token sans obliger le commerçant à ressaisir son mot de passe au quotidien.
   - Rotation automatique : à chaque rafraîchissement, l'ancien Refresh Token est révoqué et un nouveau jeton est émis.

### 1.2 Structure du Payload JWT
```json
{
  "sub": "b1820641-a182-411a-bdc3-111111111111",
  "phone": "+22997000000",
  "name": "Sikirou ADEBAYO",
  "tenant_id": "987fcdeb-51a2-43bb-a123-222222222222",
  "active_shop_id": "shop-ganhi-01",
  "role": "OWNER",
  "permissions": [
    "sales.create",
    "sales.read",
    "sales.refund",
    "inventory.manage",
    "cash_sessions.open",
    "cash_sessions.close",
    "cash_sessions.approve",
    "debts.manage",
    "reports.view"
  ],
  "iat": 1772280000,
  "exp": 1772283600
}
```

---

## 2. Matrice des Rôles & Permissions (RBAC)

Le système implémente un contrôle d'accès basé sur les rôles (Role-Based Access Control) couplé à une granularité par permission :

| Permission Système | OWNER (Propriétaire) | MANAGER (Gérant) | CASHIER (Caissier) | AUDITOR (Auditeur) |
| :--- | :---: | :---: | :---: | :---: |
| `sales.create` (Vendre & Encaisser) | ✅ | ✅ | ✅ | ❌ |
| `sales.read` (Consulter les ventes) | ✅ | ✅ | ✅ (ses ventes) | ✅ (toutes) |
| `sales.refund` (Avoirs & Remboursements) | ✅ | ✅ | ❌ (requiert PIN) | ❌ |
| `cash_sessions.open` (Ouvrir caisse) | ✅ | ✅ | ✅ | ❌ |
| `cash_sessions.close` (Clôturer caisse) | ✅ | ✅ | ✅ | ❌ |
| `cash_sessions.approve` (Valider écarts) | ✅ | ✅ | ❌ | ❌ |
| `inventory.view` (Voir stocks) | ✅ | ✅ | ✅ | ✅ |
| `inventory.edit` (Créer/Modifier produits) | ✅ | ✅ | ❌ | ❌ |
| `inventory.adjust` (Ajuster quantités) | ✅ | ✅ | ❌ | ❌ |
| `debts.manage` (Gérer crédits clients) | ✅ | ✅ | ✅ (consultation) | ✅ |
| `reports.view` (Bilans & Bénéfice net) | ✅ | ✅ | ❌ | ✅ |
| `users.manage` (Créer/Affecter employés) | ✅ | ❌ | ❌ | ❌ |
| `settings.manage` (Configuration tenant) | ✅ | ❌ | ❌ | ❌ |

---

## 3. Supervision par Code PIN Gérant (Dual-Control)

Certaines actions critiques (ex : validation d'un écart de caisse anormal, suppression d'une ligne de vente, remboursement d'un client, ou application d'une remise exceptionnelle) déclenchent le mécanisme de **Supervision par PIN Gérant** :

1. L'application mobile affiche une invite de saisie de PIN à 4 chiffres.
2. Le gérant ou propriétaire saisit son PIN confidentiel.
3. Le backend vérifie le hash bcrypt du PIN dans la table `users`.
4. Si le PIN est valide et que son propriétaire possède la permission `cash_sessions.approve` ou `sales.refund`, l'action est autorisée et le `verified_by_user_id` est horodaté dans la transaction.
5. Une preuve temporaire (`recent_pin_proof`) peut être conservée en mémoire sécurisée pendant 2 minutes pour éviter les ressaisies consécutives lors de la même session.

---

## 4. Gardes d'Isolation Multi-Tenancy

L'isolation des données est garantie à deux niveaux :
1. **Au niveau Middleware / Guard NestJS (`TenantGuard`)** :
   Chaque requête vérifie que l'utilisateur appartient au tenant spécifié dans l'URL ou le header `X-Tenant-ID`. Toute tentative d'accès à des données d'un autre tenant lève immédiatement une exception HTTP 403 Forbidden.
2. **Au niveau Base de Données (PostgreSQL RLS)** :
   Même si une clause WHERE était omise dans une requête SQL native, les politiques Supabase RLS bloquent la lecture ou l'écriture en dehors du `tenant_id` injecté dans le contexte JWT de la session.

