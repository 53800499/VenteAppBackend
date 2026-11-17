# Stratégie de Sauvegarde & Plan de Reprise d'Activité (PRA / DRP)

Ce document détaille les sauvegardes automatiques de la base de données et la procédure de restauration en cas d'incident majeur.

---

## 1. Fréquence des Sauvegardes Cloud (Supabase)

- **Sauvegardes Complètes (Dumps Quotidiens)** : Réalisées automatiquement chaque nuit à 02h00 GMT.
- **Journaux de Transactions (WAL — Point-in-Time Recovery)** : Archivage continu permettant une restauration à la seconde près (PITR) sur une fenêtre glissante de 7 à 30 jours.
- **Rétention des Sauvegardes** :
  - Sauvegardes quotidiennes conservées pendant 30 jours.
  - Sauvegardes mensuelles archivées pendant 1 an sur stockage immuable chiffré.

---

## 2. Procédure de Restauration d'Urgence

En cas de corruption de données ou d'incident d'infrastructure :
1. Identifier le point de cohérence (horodatage `T` juste avant l'incident).
2. Lancer la restauration PITR depuis la console Supabase ou via CLI :
   ```bash
   supabase db restore --target-time "2026-11-17 14:15:00+00"
   ```
3. Vérifier l'intégrité des tables financières (`sales`, `cash_sessions`, `debts`).
4. Re-pointer l'URL de base de données de l'API backend et redémarrer les conteneurs.

