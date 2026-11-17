# 11 — Guide de Déploiement & Gestion des Mises à Jour (Backend & Releases)

Ce document détaille la procédure complète pour mettre à jour le **serveur backend**, déployer des migrations SQL sans interruption de service, et distribuer de nouvelles versions logicielles aux clients (Android & Windows).

---

## 1. Déploiement d'une Mise à Jour du Backend

### 1.1 Procédure Standard de Mise à Jour (Serveur Cloud)
Lorsqu'une nouvelle version du code backend est prête :

```bash
# 1. Se connecter au serveur de production via SSH
ssh deploy@api.arike.app

# 2. Accéder au répertoire du projet backend
cd /var/www/arike/backend

# 3. Récupérer les dernières modifications Git
git pull origin main

# 4. Installer les nouvelles dépendances sans toucher aux versions verrouillées
npm ci --omit=dev

# 5. Appliquer les nouvelles migrations SQL sur Supabase
npx supabase db push

# 6. Compiler la nouvelle version TypeScript
npm run build

# 7. Redémarrer le service avec zéro interruption (PM2 ou Docker)
pm2 reload arike-api --update-env
# OU avec Docker Compose :
docker compose -f docker-compose.prod.yml up -d --build
```

### 1.2 Règle de Rétrocompatibilité des Migrations SQL
Puisque des clients mobiles hors-ligne peuvent tourner sur une version précédente pendant quelques jours, **toute nouvelle migration SQL doit être non destructrice** :
- **Autorisé** : Ajouter une nouvelle colonne avec une valeur par défaut (`ALTER TABLE sales ADD COLUMN loyalty_points INT DEFAULT 0`).
- **Autorisé** : Créer de nouvelles tables ou nouveaux index.
- **Interdit** : Renommer ou supprimer immédiatement une colonne existante utilisée par les anciennes versions de l'application cliente. (Appliquer le pattern *Expand & Contract* : rendre le champ optionnel, déployer les clients, puis supprimer le champ obsolète plusieurs mois plus tard).

### 1.3 Procédure de Rollback (Retour Arrière d'Urgence)
Si un bogue critique survient après déploiement :
```bash
# Revenir au commit précédent
git reset --hard HEAD~1
npm ci --omit=dev
npm run build
pm2 reload arike-api
```

---

## 2. Système de Distribution des Mises à Jour Clients (`app-updates`)

Le backend agit comme serveur de distribution officiel pour les applications mobiles et desktop.

### 2.1 Table de Référence `app_updates`
Chaque version distribuée est enregistrée dans la table Supabase `app_updates` :
- `platform` : `ANDROID` ou `WINDOWS`
- `version` : Numéro de version sémantique (ex : `1.0.2`)
- `build_number` : Entier séquentiel croissant (ex : `3`)
- `min_supported_build` : Build minimal exigé. Tout client ayant un build inférieur sera contraint à la mise à jour obligatoire (`force_update = true`).
- `download_url` : URL publique HTTPS du binaire APK ou EXE.
- `checksum_sha256` : Empreinte cryptographique SHA-256 du fichier pour empêcher toute altération.
- `release_notes` : Liste des nouveautés et corrections affichées au commerçant.
- `force_update` : Booléen (`true` = mise à jour obligatoire bloquante, `false` = optionnelle).

### 2.2 Endpoint Public de Vérification
L'application mobile interroge :
```http
GET /api/v1/app-updates/ANDROID?currentBuild=2
```

**Réponse JSON :**
```json
{
  "success": true,
  "data": {
    "platform": "ANDROID",
    "latestVersion": "1.0.2",
    "latestBuild": 3,
    "downloadUrl": "https://xyz.supabase.co/storage/v1/object/public/app-releases/android/arike-v1.0.2.apk",
    "checksumSha256": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    "forceUpdate": false,
    "releaseNotes": "• Clôture de caisse simplifiée avec remplissage automatique des soldes\n• Optimisation de l'impression thermique Bluetooth"
  }
}
```

---

## 3. Publication d'une Version avec le Script Automatisé

Le script `scripts/publish-update.js` automatise l'ensemble du processus de publication :

```bash
# Depuis le dossier backend/
cd backend

# Publier une mise à jour Android
node scripts/publish-update.js \
  --platform=ANDROID \
  --version=1.0.2 \
  --build=3 \
  --minBuild=1 \
  --file="../frontend/build/app/outputs/flutter-apk/app-release.apk" \
  --notes="• Clôture de caisse avec remplissage assisté des soldes attendus\n• Amélioration de la connexion Bluetooth"

# Publier une mise à jour OBLIGATOIRE (Force Update)
node scripts/publish-update.js \
  --platform=ANDROID \
  --version=1.0.2 \
  --build=3 \
  --force \
  --file="../frontend/build/app/outputs/flutter-apk/app-release.apk" \
  --notes="• MISE À JOUR CRITIQUE : Mise à niveau de sécurité obligatoire pour la caisse."

# Publier une mise à jour Windows Desktop
node scripts/publish-update.js \
  --platform=WINDOWS \
  --version=1.0.2 \
  --build=3 \
  --file="../frontend/build/windows/installer/arike-setup-v1.0.2.exe" \
  --notes="• Raccourcis clavier améliorés en caisse POS"
```

### Ce que réalise automatiquement le script :
1. Lecture et validation du fichier binaire.
2. Calcul de l'empreinte de sécurité **SHA-256**.
3. Téléversement dans le bucket Supabase Storage `app-releases` (sous `android/arike-v1.0.2.apk` ou `windows/arike-setup-v1.0.2.exe`).
4. Insertion ou mise à jour de la ligne dans la table `app_updates`.
5. Notification immédiate à tous les terminaux qui interrogeront l'API.

