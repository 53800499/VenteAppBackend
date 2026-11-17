# 03 — Catalogue Complet des API REST & Endpoints

Ce document recense l'ensemble des routes, verbes HTTP, en-têtes obligatoires, charges utiles (payloads DTO) et réponses standardisées de l'API Backend de **ARIKE (VenteApp)**.

---

## 1. Conventions Générales & En-têtes HTTP

- **Base URL locale** : `http://localhost:3000/api/v1`
- **Format Payload** : `application/json` (UTF-8)
- **Authentification** : Token JWT Bearer

### En-têtes de Requête Standard

| En-tête | Obligatoire | Description |
| :--- | :---: | :--- |
| `Authorization` | Oui* | `Bearer <access_token>` (*Sauf login et mise à jour publique) |
| `X-Tenant-ID` | Oui | UUID du compte organisation / tenant |
| `X-Shop-ID` | Oui | UUID de la boutique active dans laquelle s'exécute l'action |
| `Content-Type` | Oui | `application/json` |

---

## 2. Module 1 : Authentification & Sécurité (`/auth`)

### 2.1 Connexion avec Identifiant & Mot de Passe
- **Route** : `POST /api/v1/auth/login`
- **Rôle requis** : Public
- **Payload** :
  ```json
  {
    "phone": "+22997000000",
    "password": "MonMotDePasse123!",
    "device_name": "Samsung Galaxy A54 (Android 14)",
    "device_fingerprint": "a3f5b789-unique-hardware-id"
  }
  ```
- **Réponse HTTP 200** :
  ```json
  {
    "success": true,
    "data": {
      "access_token": "eyJhbGciOi...",
      "refresh_token": "d7a4f9e1...",
      "expires_in": 3600,
      "user": {
        "id": "b1820641-a182-411a-bdc3-111111111111",
        "name": "Sikirou ADEBAYO",
        "role": "OWNER",
        "tenant_id": "987fcdeb-51a2-43bb-a123-222222222222",
        "shops": [
          { "id": "shop-ganhi-01", "name": "Boutique Ganhi Cotonou", "is_primary": true }
        ]
      }
    }
  }
  ```

### 2.2 Rafraîchissement du Token
- **Route** : `POST /api/v1/auth/refresh`
- **Payload** : `{ "refresh_token": "d7a4f9e1..." }`
- **Réponse HTTP 200** : Nouveau couple `access_token` et `refresh_token`.

### 2.3 Vérification du PIN Gérant / Propriétaire (Supervision Caisse)
- **Route** : `POST /api/v1/auth/verify-owner-pin`
- **Headers** : `Authorization: Bearer <token>`, `X-Shop-ID`
- **Payload** : `{ "pin": "1234" }`
- **Réponse HTTP 200** :
  ```json
  {
    "success": true,
    "data": {
      "verified": true,
      "verifier_user_id": "b1820641-a182-411a-bdc3-111111111111",
      "verifier_name": "Sikirou ADEBAYO"
    }
  }
  ```

---

## 3. Module 2 : Synchronisation Offline-First (`/sync`)

### 3.1 Pull : Téléchargement des Modifications Distantes
- **Route** : `POST /api/v1/sync/pull`
- **Headers** : `Authorization`, `X-Tenant-ID`, `X-Shop-ID`
- **Payload** :
  ```json
  {
    "last_synced_at": "2026-11-17T12:00:00.000Z",
    "entities": ["products", "categories", "sales", "debts", "cash_sessions"]
  }
  ```
- **Réponse HTTP 200** :
  ```json
  {
    "success": true,
    "data": {
      "synced_at": "2026-11-17T15:30:00.000Z",
      "has_more": false,
      "changes": {
        "products": [
          { "id": "p-101", "name": "Riz Parfumé 50kg", "price": 24500, "updated_at": "2026-11-17T14:10:00Z" }
        ],
        "debts": []
      }
    }
  }
  ```

### 3.2 Push : Envoi par Lots des Mutations Hors-Ligne
- **Route** : `POST /api/v1/sync/push`
- **Headers** : `Authorization`, `X-Tenant-ID`, `X-Shop-ID`
- **Payload** :
  ```json
  {
    "batch_id": "batch-20261117-uuid",
    "mutations": [
      {
        "entity": "sales",
        "action": "CREATE",
        "id": "sale-loc-001",
        "data": { "total_amount": 37500, "payment_method": "CASH" },
        "client_timestamp": "2026-11-17T13:45:12.000Z"
      }
    ]
  }
  ```
- **Réponse HTTP 200** :
  ```json
  {
    "success": true,
    "data": {
      "applied_count": 1,
      "conflicts": [],
      "rejected": []
    }
  }
  ```

---

## 4. Module 3 : Sessions de Caisse (`/cash-sessions`)

### 4.1 Récupérer la Caisse Actuelle
- **Route** : `GET /api/v1/cash-sessions/current`
- **Description** : Renvoie la session de caisse en cours pour la boutique et l'utilisateur connecté.

### 4.2 Ouverture de Caisse
- **Route** : `POST /api/v1/cash-sessions/open`
- **Payload** :
  ```json
  {
    "opening_cash_amount": 25000.00,
    "notes": "Fond de caisse initial du matin"
  }
  ```

### 4.3 Mouvement Ponctuel d'Espèces (Apport ou Versement Coffre)
- **Route** : `POST /api/v1/cash-sessions/movement`
- **Payload** :
  ```json
  {
    "cash_session_id": "cs-uuid-001",
    "type": "DROP",
    "amount": 100000.00,
    "reason": "Dépôt de sécurité au coffre fort principal"
  }
  ```

### 4.4 Clôture de Caisse avec Justification des Écarts
- **Route** : `POST /api/v1/cash-sessions/close`
- **Payload** :
  ```json
  {
    "cash_session_id": "cs-uuid-001",
    "actual_cash_amount": 148500.00,
    "actual_mobile_money_amount": 75000.00,
    "discrepancy_reason": "Erreur de rendu de monnaie billet de 1000 F non réclamé",
    "owner_pin_verification": "1234"
  }
  ```

---

## 5. Module 4 : Catalogue, Produits & Stock (`/inventory`)

- `GET /api/v1/inventory/products` : Liste des produits avec pagination, recherche et filtres de catégorie.
- `POST /api/v1/inventory/products` : Création d'un nouvel article (nom, code-barres, prix d'achat, prix de vente, stock initial).
- `PUT /api/v1/inventory/products/:id` : Mise à jour des informations et des tarifs.
- `DELETE /api/v1/inventory/products/:id` : Suppression logique (`deleted_at = NOW()`).
- `POST /api/v1/inventory/stock-adjustment` : Ajustement manuel de stock avec motif (inventaire physique, perte, casse, vol).
- `GET /api/v1/inventory/low-stock` : Liste immédiate des produits ayant atteint ou franchi le seuil d'alerte critique.

---

## 6. Module 5 : Ventes & Encaissements (`/sales`)

- `POST /api/v1/sales` : Enregistrement d'une vente complète (panier d'articles, client, réductions, règlements espèces/MoMo/crédit).
- `GET /api/v1/sales/:id` : Détails d'un ticket de vente.
- `GET /api/v1/sales/summary/today` : Synthèse financière du jour (chiffre d'affaires, marge brute estimée, nombre de tickets).
- `POST /api/v1/sales/:id/refund` : Avoir ou remboursement partiel/total d'articles avec réintégration automatique en stock.

---

## 7. Module 6 : Dettes & Recouvrements (`/debts`)

- `GET /api/v1/debts` : Répertoire des créances actives et impayées.
- `GET /api/v1/debts/overdue` : Créances dont la date d'échéance est dépassée (alerte rouge).
- `POST /api/v1/debts/:id/pay` : Enregistrement d'un règlement d'acompte ou solde de dette avec génération de reçu de paiement.
- `POST /api/v1/debts/:id/whatsapp-reminder` : Génération du message normalisé prêt à l'envoi avec décompte financier précis.

---

## 8. Module 7 : Mises à Jour Logicielles (`/app-updates`)

- `GET /api/v1/app-updates/check` :
  - **Query** : `?platform=android&current_version=1.0.1`
  - **Réponse HTTP 200** :
    ```json
    {
      "success": true,
      "data": {
        "has_update": true,
        "latest_version": "1.0.2",
        "download_url": "https://arike.app/downloads/arike-v1.0.2-release.apk",
        "checksum_sha256": "8a3e7b1...",
        "mandatory": false,
        "release_notes": "Correction du calcul de clôture de caisse et amélioration du scan code-barres."
      }
    }
    ```

