# ADR 0002 — Choix de PostgreSQL avec Supabase et Row-Level Security (RLS)

## Statut
Accepté

## Contexte
ARIKE est une solution multi-tenants où chaque organisation commerçante possède une ou plusieurs boutiques. Les données financières et comptables sont strictement confidentielles et ne doivent en aucun cas fuiter d'un tenant à un autre.

## Décision
Nous avons choisi **PostgreSQL hébergé via Supabase** avec activation systématique de **Row-Level Security (RLS)** :
- **Sécurité au Niveau Moteur SQL** : Même en cas de bug applicatif (ex : clause WHERE oubliée dans un service NestJS), le moteur PostgreSQL bloque l'accès aux lignes n'appartenant pas au `tenant_id` du JWT actif.
- **Support des Migrations Structurées** : Schéma relationnel versionné via 59 scripts SQL ordonnés, assurant la reproductibilité entre environnements.
- **Capacités Analytiques Supérieures** : Calculs d'agrégation rapides (marges, TVA, chiffres d'affaires, balances de caisse) grâce aux index composites et aux fonctions de fenêtrage PostgreSQL.

## Conséquences
- Protection absolue contre les fuites de données inter-tenants.
- Les requêtes complexes utilisent la puissance relationnelle de SQL plutôt que des jointures manuelles en mémoire dans Node.js.

