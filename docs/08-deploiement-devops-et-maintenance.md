# 08 — Déploiement, DevOps & Maintenance

Ce document fournit le guide complet de mise en production, la liste exhaustive des variables d'environnement, les configurations Docker et les procédures de maintenance du backend de **ARIKE (VenteApp)**.

---

## 1. Variables d'Environnement (`.env`)

Créez un fichier `.env` à la racine du dossier `backend/` en vous basant sur la matrice suivante :

```env
# ==============================================================================
# CONFIGURATION SERVEUR & RUNTIME
# ==============================================================================
NODE_ENV=production
PORT=3000
API_PREFIX=api/v1
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://arike.app,https://admin.arike.app

# ==============================================================================
# BASE DE DONNÉES SUPABASE (POSTGRESQL)
# ==============================================================================
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:your-db-password@db.your-project-id.supabase.co:5432/postgres

# ==============================================================================
# SÉCURITÉ & AUTHENTIFICATION (JWT)
# ==============================================================================
JWT_SECRET=super_secret_jwt_key_pour_la_production_32_caracteres_min
JWT_EXPIRATION=3600s
REFRESH_TOKEN_SECRET=autre_cle_secrete_ultra_robuste_pour_refresh_tokens
REFRESH_TOKEN_EXPIRATION=90d

# ==============================================================================
# PASSERELLES PAIEMENT MOBILE MONEY (FEDAPAY / CINETPAY)
# ==============================================================================
FEDAPAY_SECRET_KEY=sk_live_...
FEDAPAY_PUBLIC_KEY=pk_live_...
FEDAPAY_WEBHOOK_SECRET=whsec_...
CINETPAY_API_KEY=...
CINETPAY_SITE_ID=...

# ==============================================================================
# DISTRIBUTION DES MISES À JOUR APP (AUTO-UPDATER)
# ==============================================================================
UPDATE_STORAGE_PATH=/var/www/arike-releases/
UPDATE_DOWNLOAD_BASE_URL=https://releases.arike.app/
```

---

## 2. Déploiement avec Docker

### 2.1 Dockerfile de Production
Le backend utilise un Dockerfile multi-stage optimisé pour minimiser la taille de l'image et renforcer la sécurité :

```dockerfile
# Étape 1 : Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

# Étape 2 : Runtime léger de production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/main"]
```

### 2.2 Docker Compose
```yaml
version: '3.8'

services:
  arike-backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: arike_backend_api
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - .env
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/v1/health"]
      interval: 30s
      timeout: 5s
      retries: 3
```

---

## 3. Publication d'une Nouvelle Version Mobile / Desktop

Pour mettre à disposition une nouvelle version pour la mise à jour automatique des utilisateurs :

```bash
# Script automatisé de publication de release
node scripts/publish-update.js --platform=android --version=1.0.2 --file=./releases/app-release.apk --notes="Correction caisse et impression thermique"
```

Ce script :
1. Calcule l'empreinte SHA-256 du fichier binaire.
2. Déplace le fichier vers le stockage public des releases.
3. Insère ou met à jour la ligne correspondante dans la table `app_updates` de Supabase.
4. Dès cet instant, tous les terminaux mobiles et ordinateurs recevront la notification de mise à jour au prochain démarrage.

---

## 4. Scripts de Maintenance & Déduplication

- **Déduplication des articles par nom** :
  `scripts/dedupe_products_by_name.sql` permet de nettoyer les bases d'articles en cas de doublons créés par des saisies manuelles répétées sans code-barres.
- **Surveillance en développement** :
  `scripts/dev-watch.js` assure le redémarrage automatique avec gestion propre des ports occupés sous Windows et Linux.

