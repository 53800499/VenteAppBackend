# Guide de Déploiement, DevOps & Exploitation — VenteApp (ARIKE)

---

## 1. Topologie des Environnements

Le cycle de vie applicatif de **VenteApp (ARIKE)** est structuré en trois environnements étanches :

```
┌────────────────────────────────────────────────────────────────────────┐
│                      MATRICE DES ENVIRONNEMENTS                        │
├─────────────────┬──────────────────────┬───────────────────────────────┤
│ Environnement   │ Rôle & Périmètre     │ Infrastructure Cible          │
├─────────────────┼──────────────────────┼───────────────────────────────┤
│ **Développement**| Développement local, │ Localhost / SQLite mémoire    │
│                 │ tests unitaires      │ Node 20 / Emulateur Android   │
├─────────────────┼──────────────────────┼───────────────────────────────┤
│ **Staging / QA**| Recette métier,      │ Render Web Service (Staging)  │
│                 │ tests de charge      │ Supabase Project (Staging)    │
├─────────────────┼──────────────────────┼───────────────────────────────┤
│ **Production**  | Exploitation réelle, │ Render / VPS Dockerisé        │
│                 │ commerces actifs     │ Supabase Pro + Google Play    │
└─────────────────┴──────────────────────┴───────────────────────────────┘
```

---

## 2. Déploiement Mobile (Flutter)

### 2.1 Stratégie de Distribution Mobile — Option A (APK Universel & Mises à Jour OTA)

#### 1. Distribution Directe sur Site Web (Option A : APK Universel Infaillible)
Pour les commerçants installant ARIKE directement depuis le site officiel (`/download`) sans passer par Google Play :
- **Principe** : Distribution d'un **APK Universel** multi-architectures (`arm64-v8a` + `armeabi-v7a` + `x86_64`).
- **Avantage clé** : L'utilisateur n'a **aucun choix technique d'architecture** à faire. L'APK est 100% garanti de s'installer sur n'importe quel smartphone Android (Infinix, Tecno, Samsung, Xiaomi, Itel, etc.), sans erreur `INSTALL_FAILED_NO_MATCHING_ABIS`.
- **Route permanente de téléchargement** : Le site web et les QR codes exposent une URL unique :
  ```text
  https://arike.app/download
  ```
  Cette route Next.js redirige automatiquement (HTTP 307) vers le dernier binaire universel, sans nécessiter de redéployer le site web à chaque version d'APK.

#### 2. Génération de l'APK Universel avec Shorebird (Recommandé)
```bash
cd frontend
shorebird release android
```
- *Fichier généré :* `frontend/build/app/outputs/shorebird-apk/universal.apk` (~108 Mo).
- *Déploiement Web :* Placer le fichier dans `LandinPage/public/downloads/arike-latest.apk` (ou configurer la variable d'environnement `APK_DOWNLOAD_URL` vers un bucket S3 / Supabase Storage).

#### 3. Déploiement de Correctifs et Fonctionnalités OTA (Shorebird Code Push)
Grâce à l'intégration Shorebird, **l'utilisateur ne télécharge l'APK universel qu'une seule fois** à la première installation. Toutes les modifications de code Dart/Flutter suivantes sont déployées en temps réel par les airs :
```bash
cd frontend
shorebird patch android
```
*L'application ARIKE se met à jour silencieusement au redémarrage en tâche de fond, sans nécessiter de nouveau téléchargement d'APK.*

#### 4. Paquet AAB (Pour publication ultérieure Google Play Store)
```bash
flutter build appbundle --release --obfuscate --split-debug-info=build/app/outputs/symbols
```

### 2.2 Signature de l'Application (`key.properties`)
Fichier de configuration `android/key.properties` (non versionné dans Git) :
```properties
storePassword=SECURE_KEYSTORE_PASSWORD
keyPassword=SECURE_KEY_PASSWORD
keyAlias=venteapp-release-key
storeFile=/secure/path/to/venteapp_keystore.jks
```

### 2.3 Règles d'Obfuscation & ProGuard (`android/app/proguard-rules.pro`)
```proguard
# Préservation des classes SQLite Drift et Chiffrement
-keep class com.simonpham.sqlite3mc.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**
```

---

## 3. Déploiement Backend (NestJS / Docker)

### 3.1 Dockerfile Multi-Stage Haute Performance
```dockerfile
# Étape 1 : Build de l'application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Étape 2 : Image d'exécution de production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/main"]
```

### 3.2 Configuration Déploiement Render (`render.yaml`)
```yaml
services:
  - type: web
    name: venteapp-backend-api
    runtime: node
    plan: standard
    buildCommand: npm ci && npm run build
    startCommand: npm run start:prod
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: JWT_SECRET
        sync: false
```

---

## 4. Déploiement Web Back-Office (Next.js 15)

### 4.1 Déploiement sur Vercel (Recommandé)
- **Framework Preset** : `Next.js`
- **Build Command** : `next build`
- **Output Directory** : `.next`
- **Node.js Version** : `20.x`

### 4.2 Déploiement Docker Standalone
Le fichier `next.config.ts` inclut l'instruction `output: "standalone"` pour générer un conteneur léger de moins de 120 Mo.

---

## 5. Exploitation Base de Données Cloud (Supabase / PostgreSQL)

### 5.1 Application des Migrations SQL
Toutes les migrations du dossier `backend/supabase/migrations/` sont appliquées de manière séquentielle et idempotente via la CLI Supabase :
```bash
supabase db push --linked
```

### 5.2 Paramétrage du Connection Pooler (PgBouncer)
Pour supporter des milliers de terminaux mobiles synchronisant simultanément :
- **Mode de Pool** : `Transaction Mode` (Port `6543`).
- **Pool Size Maximum** : `100 connexions actives`.
- **Default Statement Timeout** : `10 secondes` (évite les requêtes bloquantes).

### 5.3 Stratégie de Sauvegardes & Reprise après Sinistre (DRP)
- **Sauvegardes Quotidiennes Automatiques** : Snapshots complets PostgreSQL conservés sur 30 jours glissants (Point-in-Time Recovery - PITR).
- **Objectif de Point de Récupération (RPO)** : `< 1 heure`.
- **Objectif de Temps de Récupération (RTO)** : `< 15 minutes`.

---

## 6. Variables d'Environnement & Gestion des Secrets

```
┌────────────────────────────────────────────────────────────────────────┐
│               VARIABLES D'ENVIRONNEMENT DE PRODUCTION                  │
├─────────────────────────┬──────────────────────────────────────────────┤
│ **`PORT`**              │ Port d'écoute HTTP du serveur (ex: 3000)     │
├─────────────────────────┼──────────────────────────────────────────────┤
│ **`SUPABASE_URL`**      │ URL d'accès HTTPS au projet Supabase         │
├─────────────────────────┼──────────────────────────────────────────────┤
│ **`SUPABASE_KEY`**      │ Clé Service Role (contourne RLS pour admin)  │
├─────────────────────────┼──────────────────────────────────────────────┤
│ **`JWT_SECRET`**        │ Clé secrète de signature des tokens HMAC-256 │
├─────────────────────────┼──────────────────────────────────────────────┤
│ **`JWT_EXPIRATION`**    │ Durée de validité des tokens (ex: 86400s)    │
├─────────────────────────┼──────────────────────────────────────────────┤
│ **`BACKUP_ENCRYPTION_`**│ Clé maître pour chiffrement des sauvegardes  │
│ **`MASTER_KEY`**        │ système AES-256                              │
└─────────────────────────┴──────────────────────────────────────────────┘
```

---

## 7. Monitoring, Supervision & Alertes

1. **Sonde de Santé Applicative (`/health`)** : Vérifie l'accessibilité de la base de données, la latence et la charge CPU.
2. **Journalisation Centralisée des Erreurs** : Capture en temps réel des erreurs 500 avec stack-trace et notification immédiate sur canal Discord / Slack d'astreinte.
3. **Procédure de Rollback Immédiat** : En cas d'incident critique lors d'une mise à jour, Render et Vercel permettent le retour en un clic à la version précédente (*Instant Rollback*).
