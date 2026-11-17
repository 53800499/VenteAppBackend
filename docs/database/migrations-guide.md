# Guide de Gestion des Migrations SQL

Ce document détaille la procédure de déploiement et d'évolution du schéma de base de données PostgreSQL dans ARIKE.

---

## 1. Organisation des Migrations

Les migrations se situent dans `backend/supabase/migrations/` et sont numérotées séquentiellement :
- `001_auth_schema.sql` : Tables de base d'authentification et utilisateurs.
- `002_rbac_schema.sql` : Rôles, permissions et affectations.
- `003_tenant_rls.sql` : Politiques Row-Level Security pour isoler les tenants.
- `004_commerce_schema.sql` à `059_app_updates_and...sql` : Évolutions successives (ventes, caisses, dettes, lots, change FX, abonnements, distribution d'APK).

---

## 2. Exécution d'une Nouvelle Migration

Pour appliquer une nouvelle migration sur la base Supabase :

### Via Supabase CLI (Recommandé)
```bash
# Vérifier la différence entre le code local et la base distante
supabase db diff

# Appliquer les migrations en attente sur l'instance distante
supabase db push
```

### Via Requête SQL Directe (Tableau de bord Supabase)
1. Ouvrir le tableau de bord Supabase du projet.
2. Accéder à **SQL Editor**.
3. Copier le contenu du fichier de migration (ex : `060_ma_nouvelle_table.sql`).
4. Cliquer sur **RUN** et vérifier le message `Success. No rows returned`.

