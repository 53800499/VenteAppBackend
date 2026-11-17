# 09 — Guide Complet des Commandes & Scripts du Backend

Ce document recense et explique **l'intégralité des commandes CLI et scripts** utilisés pour développer, tester, migrer, maintenir et déployer le backend **ARIKE (NestJS)**.

---

## 1. Commandes de Développement & Cycle de Vie (`npm`)

Toutes ces commandes s'exécutent depuis le dossier `backend/` :

```bash
cd backend
```

| Commande | Action & Rôle Technique | Contexte d'Utilisation |
| :--- | :--- | :--- |
| `npm install` | Installe toutes les dépendances déclarées dans `package.json`. | Après un clone du projet ou un ajout de package. |
| `npm run start:dev` | Lance l'API avec le script de surveillance custom `scripts/dev-watch.js`. | **Mode de travail quotidien recommandé**. Gère la libération automatique des ports occupés sous Windows. |
| `npm run start:nest-watch` | Lance le serveur en mode rechargement à chaud standard NestJS (`nest start --watch`). | Alternative au dev-watch. |
| `npm run start:debug` | Démarre le serveur avec l'inspecteur Node.js activé sur le port 9229. | Débogage avancé pas-à-pas avec VS Code ou Chrome DevTools. |
| `npm run build` | Compile l'ensemble du projet TypeScript vers JavaScript optimisé dans le dossier `dist/`. | Prérequis obligatoire avant mise en production. |
| `npm run start:prod` | Exécute le serveur compilé de production (`node dist/main`). | Utilisé dans les conteneurs Docker de production. |
| `npm run lint` | Analyse et corrige automatiquement les règles de formatage et de typage avec ESLint. | Avant chaque commit Git pour garantir la propreté du code. |
| `npm run format` | Réindente et reformate le code avec Prettier (`src/**/*.ts`). | Harmonisation esthétique du code source. |

---

## 2. Commandes de Tests Automatisés

| Commande | Action & Rôle Technique |
| :--- | :--- |
| `npm test` | Exécute tous les tests unitaires avec **Jest**. |
| `npm run test:watch` | Exécute les tests en continu et les relance dès qu'un fichier est modifié. |
| `npm run test:cov` | Exécute les tests et génère un rapport de couverture de code dans `coverage/`. |
| `npm run test:e2e` | Exécute les tests de bout en bout (End-to-End) avec la configuration `test/jest-e2e.json`. |
| `npm run test:debug` | Lance les tests Jest avec point d'arrêt pour débogage. |

---

## 3. Scripts Utilitaires Personnalisés (`backend/scripts/`)

### 3.1 Publication d'une Mise à Jour Mobile/Desktop (`publish-update.js`)
Ce script permet de téléverser un binaire APK ou Windows sur le stockage Supabase et de l'enregistrer dans la table `app_updates` pour déclencher la mise à jour automatique des utilisateurs :

```bash
# Exemple pour Android (APK)
node scripts/publish-update.js --platform=ANDROID --version=1.0.2 --file="../frontend/build/app/outputs/flutter-apk/app-release.apk" --notes="Amélioration du calcul de clôture de caisse et impression thermique"

# Exemple pour Windows (EXE)
node scripts/publish-update.js --platform=WINDOWS --version=1.0.2 --file="../frontend/build/windows/installer/arike-setup-v1.0.2.exe" --notes="Correction des raccourcis clavier en caisse"

# Rendre la mise à jour obligatoire (bloquante jusqu'à installation)
node scripts/publish-update.js --platform=ANDROID --version=1.0.2 --file="..." --mandatory
```

### 3.2 Surveillance & Redémarrage Propre sous Windows (`dev-watch.js`)
Sous Windows, les processus Node.js peuvent parfois rester orphelins en arrière-plan et verrouiller le port `3000` ou `3009`. Le script `dev-watch.js` :
1. Détecte le port configuré.
2. Tue automatiquement tout processus zombie écoutant sur ce port via `netstat` et `taskkill`.
3. Lance NestJS dans un état sain.

### 3.3 Déduplication des Articles par Nom (`dedupe_products_by_name.sql`)
Permet de fusionner les produits en double créés par mégarde sans code-barres :
```bash
# Exécution via psql ou dans le SQL Editor de Supabase
psql $DATABASE_URL -f scripts/dedupe_products_by_name.sql
```

---

## 4. Commandes de Base de Données & Supabase CLI

```bash
# Se connecter à Supabase via la CLI
npx supabase login

# Lier le dossier local au projet distant
npx supabase link --project-ref your-project-id

# Comparer le schéma distant avec les migrations locales
npx supabase db diff

# Appliquer toutes les nouvelles migrations sur la base distante
npx supabase db push

# Exécuter une migration SQL spécifique directement
psql "postgresql://postgres:password@db.your-project.supabase.co:5432/postgres" -f supabase/migrations/057_cash_sessions_redesign.sql
```

---

## 5. Commandes Docker de Production

```bash
# Construire l'image Docker du backend
docker build -t arike-backend:latest .

# Lancer le conteneur avec variables d'environnement
docker run -d --name arike_api -p 3000:3000 --env-file .env arike-backend:latest

# Voir les logs en direct
docker logs -f arike_api

# Redémarrer le conteneur après mise à jour
docker restart arike_api
```

---

## 6. Dépannage des Conflits de Port sous Windows

Si le message `EADDRINUSE: address already in use :::3000` apparaît :

```powershell
# 1. Identifier le PID du processus occupant le port 3000
netstat -ano | findstr :3000

# 2. Tuer le processus avec son PID (ex : PID 14520)
taskkill /F /PID 14520
```
