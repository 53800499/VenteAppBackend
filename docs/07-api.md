# Documentation des API REST & Contrats d'Interface — VenteApp (ARIKE)

---

## 1. Normes Générales & Conventions d'API

L'API Backend de **VenteApp (ARIKE)** respecte les standards de conception **RESTful** et les spécifications **OpenAPI 3.1 / Swagger**.

### 1.1 Informations de Base
- **Protocole & Format** : `HTTPS / TLS 1.3`, Payload et Réponses en `application/json`.
- **Préfixe Global & Versioning** : `/api/v1`
- **Serveur de Développement Local** : `http://localhost:3000/api/v1`
- **Documentation Interactive Swagger** : `http://localhost:3000/api/docs`

### 1.2 En-têtes HTTP Obligatoires

| Header HTTP | Type | Obligatoire | Description |
| :--- | :--- | :---: | :--- |
| `Authorization` | `String` | **Oui** (sauf auth) | Token JWT au format `Bearer <token>`. |
| `X-Tenant-ID` | `UUID / String`| **Oui** | Identifiant unique de l'organisation/tenant. |
| `X-Shop-ID` | `Integer` | **Oui** | Identifiant de la boutique active. |
| `Idempotency-Key`| `UUID / String`| Recommandé (POST) | Clé d'idempotence pour prévenir les doublons réseau. |
| `Content-Type` | `String` | **Oui** | `application/json` |

### 1.3 Format Standardisé des Réponses JSON

#### Réponse de Succès
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": 1772280000000,
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

#### Réponse d'Erreur
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Stock insuffisant pour le produit sélectionné.",
    "details": {
      "productId": 42,
      "requestedQuantity": 5,
      "availableQuantity": 2
    },
    "timestamp": 1772280000000
  }
}
```

---

## 2. Catalogue des Endpoints par Domaine Métier

### 2.1 Authentification & Sessions (`/auth`)

#### `POST /auth/login-pin` — Connexion par Code PIN
Permet au commerçant ou à un vendeur de s'authentifier sur le terminal mobile.
- **Corps de la Requête (Request Body)** :
```json
{
  "shopId": 1,
  "phone": "+22997001122",
  "pin": "1234"
}
```
- **Réponse Succès (200 OK)** :
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "d8f9a2e1-4c3b-4a5d-8e6f-1a2b3c4d5e6f",
    "expiresIn": 86400,
    "user": {
      "id": 1,
      "name": "Kofi AGBOVI",
      "role": "owner",
      "shopId": 1,
      "tenantId": "org_c8f3a1b2-9d4e-4f1a-b3c2-1e5f8a9b0c1d"
    }
  }
}
```

#### `POST /auth/refresh` — Rafraîchissement du Token d'Accès
```json
{
  "refreshToken": "d8f9a2e1-4c3b-4a5d-8e6f-1a2b3c4d5e6f"
}
```

---

### 2.2 Inventaire & Catalogue (`/inventory`)

#### `GET /inventory/products` — Liste des Produits
- **Paramètres Query** : `categoryId`, `search`, `lowStock=true`, `page=1`, `limit=50`.
- **Réponse Succès (200 OK)** :
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "name": "Riz Parfumé 25kg",
      "barcode": "6151100012345",
      "unit": "sac",
      "priceSell": 17500,
      "priceBuy": 15000,
      "quantityInStock": 14,
      "alertThreshold": 5,
      "category": {
        "id": 2,
        "name": "Riz & Céréales",
        "colorHex": "#E67E22"
      }
    }
  ]
}
```

#### `POST /inventory/stock-adjustments` — Ajustement Manuel de Stock
- **Corps de la Requête** :
```json
{
  "productId": 10,
  "type": "adjustment",
  "quantityChange": -2,
  "reason": "Sac percé lors du déchargement — perte constatée"
}
```

---

### 2.3 Gestion des Ventes (`/sales`)

#### `POST /sales` — Enregistrement d'une Nouvelle Vente
- **Corps de la Requête** :
```json
{
  "saleType": "standard",
  "customerId": 5,
  "items": [
    {
      "productId": 10,
      "quantity": 2,
      "unitPrice": 17500,
      "discountAmount": 0
    },
    {
      "productId": 15,
      "quantity": 3,
      "unitPrice": 1000,
      "discountAmount": 0
    }
  ],
  "subtotal": 38000,
  "discountAmount": 1000,
  "totalAmount": 37000,
  "amountPaid": 20000,
  "amountCredit": 17000,
  "paymentMethod": "mixed",
  "payments": [
    {
      "method": "cash",
      "amount": 20000
    }
  ]
}
```
- **Réponse Succès (201 Created)** :
```json
{
  "success": true,
  "data": {
    "id": 42,
    "receiptNumber": "REC-20260228-0042",
    "totalAmount": 37000,
    "amountPaid": 20000,
    "amountCredit": 17000,
    "createdDebtId": 8,
    "status": "completed",
    "createdAt": 1772281200000
  }
}
```

#### `POST /sales/:id/cancel` — Annulation d'une Vente (< 24h)
- **Corps de la Requête** :
```json
{
  "reason": "Erreur de saisie client — articles retournés immédiatement"
}
```

---

### 2.4 Dettes & Recouvrement (`/debts`)

#### `GET /debts` — Liste des Créances Clients
- **Paramètres Query** : `customerId`, `status` (`open`, `partial`, `paid`, `forgiven`), `criticalOnly=true`.

#### `POST /debts/:id/pay` — Enregistrement d'un Remboursement / Acompte
- **Corps de la Requête** :
```json
{
  "amount": 10000,
  "method": "mtn_momo",
  "reference": "TXN_MOMO_987654321",
  "note": "Acompte versé par le frère de la cliente"
}
```
- **Réponse Succès (200 OK)** :
```json
{
  "success": true,
  "data": {
    "debtId": 8,
    "amountPaid": 10000,
    "remainingAmount": 7000,
    "status": "partial",
    "customerBalanceDue": 7000,
    "receiptNumber": "REC-PAY-20260228-0012"
  }
}
```

#### `POST /debts/:id/forgive` — Pardon Commercial d'une Dette
- **Corps de la Requête** :
```json
{
  "reason": "Geste de solidarité pour fidélité commerciale (2 ans sans incident)"
}
```

---

### 2.5 Sessions de Caisse (`/cash-sessions`)

#### `POST /cash-sessions/open` — Ouverture de Caisse
```json
{
  "openingAmount": 25000,
  "note": "Fond de caisse en petites coupures de 500 et 1000 F"
}
```

#### `POST /cash-sessions/close` — Clôture de Caisse avec Comptage
```json
{
  "closingAmountCounted": 224500,
  "note": "Clôture conforme de fin de journée"
}
```
- **Réponse Succès (200 OK)** :
```json
{
  "success": true,
  "data": {
    "sessionId": 14,
    "openingAmount": 25000,
    "totalCashSales": 210000,
    "totalCashExpenses": 10500,
    "closingAmountExpected": 224500,
    "closingAmountCounted": 224500,
    "discrepancy": 0,
    "status": "closed"
  }
}
```

---

### 2.6 Moteur de Synchronisation Cloud (`/sync`)

#### `POST /sync/push` — Envoi des Événements Locaux Batchés
- **Corps de la Requête** :
```json
{
  "batchId": "b1a2c3-d4e5-6f7a",
  "events": [
    {
      "tableName": "sales",
      "recordId": 42,
      "operation": "insert",
      "localVersion": 1,
      "payload": { ... }
    },
    {
      "tableName": "debt_payments",
      "recordId": 12,
      "operation": "insert",
      "localVersion": 1,
      "payload": { ... }
    }
  ]
}
```

#### `GET /sync/pull` — Récupération des Mises à Jour Distantes
- **Paramètres Query** : `sinceVersion=1420`, `shopId=1`.

---

### 2.7 Bureau de Change FX (`/fx-exchange`)

#### `POST /fx-exchange/operations` — Enregistrement d'une Opération de Change
```json
{
  "currencyCode": "NGN",
  "operationType": "buy",
  "foreignAmount": 50000,
  "appliedRate": 0.42,
  "localAmount": 21000,
  "customerName": "Musa Ibrahim"
}
```

---

### 2.8 Journal d'Audit (`/audit`)

#### `GET /audit/logs` — Consultation des Actions Sensibles (Owner Only)
- **Paramètres Query** : `module`, `userId`, `startDate`, `endDate`, `action`.
- **Réponse Succès (200 OK)** :
```json
{
  "success": true,
  "data": [
    {
      "id": 104,
      "action": "debt_forgiven",
      "module": "debts",
      "entityId": 8,
      "userName": "Kofi AGBOVI",
      "reason": "Geste de solidarité pour fidélité commerciale",
      "oldValue": { "status": "partial", "remainingAmount": 7000 },
      "newValue": { "status": "forgiven", "remainingAmount": 0 },
      "createdAt": 1772284800000
    }
  ]
}
```
