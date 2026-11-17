# Référentiel du Schéma de Base de Données

Ce document décrit en détail les types, contraintes et index des tables fondamentales de la base PostgreSQL d'ARIKE.

---

## 1. Table `tenants` (Comptes Entreprises)
- `id` : `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `name` : `VARCHAR(255) NOT NULL` — Raison sociale de l'entreprise
- `currency` : `VARCHAR(10) DEFAULT 'XOF'` — Devise comptable par défaut
- `plan` : `VARCHAR(50) DEFAULT 'FREE'` — Formule d'abonnement active
- `is_active` : `BOOLEAN DEFAULT TRUE`
- `created_at` / `updated_at` : `TIMESTAMPTZ`

---

## 2. Table `shops` (Boutiques & Points de Vente)
- `id` : `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id` : `UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- `name` : `VARCHAR(255) NOT NULL` (ex : "Boutique Ganhi Cotonou")
- `address` : `TEXT NULL`
- `phone` : `VARCHAR(50) NULL`
- `is_primary` : `BOOLEAN DEFAULT FALSE` — Vrai pour le magasin principal
- `created_at` / `updated_at` : `TIMESTAMPTZ`

---

## 3. Table `users` (Utilisateurs & Caissiers)
- `id` : `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id` : `UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- `name` : `VARCHAR(255) NOT NULL`
- `phone` : `VARCHAR(50) UNIQUE NOT NULL` — Identifiant de connexion principal
- `password_hash` : `VARCHAR(255) NOT NULL` — Hash bcrypt du mot de passe
- `owner_pin_hash` : `VARCHAR(255) NULL` — Hash bcrypt du PIN gérant à 4 chiffres
- `role` : `VARCHAR(50) NOT NULL DEFAULT 'CASHIER'`
- `is_active` : `BOOLEAN DEFAULT TRUE`

---

## 4. Table `products` (Catalogue Articles)
- `id` : `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id` : `UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- `shop_id` : `UUID NOT NULL REFERENCES shops(id)`
- `name` : `VARCHAR(255) NOT NULL`
- `barcode` : `VARCHAR(100) NULL` — Code-barres EAN-13 ou SKU interne
- `purchase_price` : `DECIMAL(15,2) DEFAULT 0.00` — Prix d'achat unitaire
- `selling_price` : `DECIMAL(15,2) NOT NULL` — Prix de vente public standard
- `min_stock_alert` : `INT DEFAULT 5` — Seuil déclencheur d'alerte stock bas
- `deleted_at` : `TIMESTAMPTZ NULL` — Soft Delete pour sync offline

---

## 5. Table `sales` (En-têtes de Ventes)
- `id` : `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `tenant_id` : `UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- `shop_id` : `UUID NOT NULL REFERENCES shops(id)`
- `cash_session_id` : `UUID NULL REFERENCES cash_sessions(id)`
- `customer_id` : `UUID NULL REFERENCES customers(id)`
- `receipt_number` : `VARCHAR(50) NOT NULL` — Ex : `VT-2026-00042`
- `total_amount` : `DECIMAL(15,2) NOT NULL` — Montant brut des articles
- `discount_amount` : `DECIMAL(15,2) DEFAULT 0.00`
- `final_amount` : `DECIMAL(15,2) NOT NULL` — Montant net à régler
- `paid_amount` : `DECIMAL(15,2) NOT NULL` — Montant effectivement encaissé
- `debt_amount` : `DECIMAL(15,2) DEFAULT 0.00` — Solde restant dû à crédit
- `payment_method` : `VARCHAR(50) NOT NULL` (`CASH`, `MOMO`, `MOOV`, `CREDIT`, `SPLIT`)

