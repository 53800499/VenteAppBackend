# ADR 0003 — Choix du Protocole de Synchronisation Offline-First par Deltas

## Statut
Accepté

## Contexte
En Afrique de l'Ouest, les connexions Internet mobiles sont fluctuantes. Les commerçants doivent pouvoir enregistrer des centaines de ventes et de mouvements de caisse sans aucune connectivité pendant plusieurs jours, puis synchroniser leurs données rapidement dès le retour du réseau.

## Décision
Nous avons conçu un protocole sur-mesure basé sur les principes suivants :
1. **Identifiants Décentralisés UUIDv4** : Tous les enregistrements créés hors-ligne portent un UUIDv4 généré par le client, éliminant les allers-retours avec la base centrale pour obtenir un ID.
2. **Push Idempotent par Lots (`/sync/push`)** : Le terminal client transmet un tableau de mutations associé à un `batch_id`. Si la requête est interrompue par une coupure réseau et réémise, le backend ignore les doublons sans erreur.
3. **Pull Différentiel Horodaté (`/sync/pull`)** : Le client transmet son dernier horodatage de synchronisation (`last_synced_at`). Le backend ne retourne que les enregistrements créés, modifiés ou supprimés logiquement (`deleted_at`) après cette date.
4. **Décrémentation Relative du Stock** : Les ventes hors-ligne appliquent des deltas relatifs (`stock = stock - quantite_vendue`) pour éviter les conflits d'écrasement absolu entre deux vendeurs opérant en même temps.

## Conséquences
- Économie maximale de bande passante mobile (quelques kilo-octets par synchronisation).
- Résilience totale face aux coupures réseau inopinées.

