# Spécifications Fonctionnelles Détaillées (SFD) — VenteApp (ARIKE)

---

## 1. Introduction & Conventions de Lecture

### 1.1 Objet du Document
Le présent document constitue les **Spécifications Fonctionnelles Détaillées (SFD)** de **VenteApp (ARIKE)**, versions 2.0 et 3.0. Il décrit de manière exhaustive le comportement fonctionnel de chaque module, les règles métier applicables, les cas d'utilisation, les maquettes d'écrans, les flux opérationnels et le catalogue complet des cas d'erreur.

### 1.2 Conventions & Notations
| Notation | Signification |
| :--- | :--- |
| **`[RG-XXX-NN]`** | **Règle de Gestion** : Règle métier obligatoire et contraignante à implémenter. |
| **`[UC-NN]`** | **Use Case (Cas d'Utilisation)** : Scénario décrivant l'interaction acteur/système. |
| **`[ECR-NN]`** | **Écran / Interface** : Spécification d'un écran de l'application Flutter ou du Back-Office. |
| **`[ERR-NN]`** | **Code d'Erreur** : Message et comportement associé à une anomalie ou validation échouée. |
| **`🆕 v2.0 / v3.0`** | Fonctionnalité, règle ou écran introduit ou enrichi dans les versions évoluées. |

---

## 2. Module 1 : Authentification, PIN, Biométrie & Sécurité

### 2.1 Description Générale
L'application est protégée par un code PIN à 4 ou 6 chiffres. En complément, l'authentification biométrique (empreinte digitale ou reconnaissance faciale) peut être activée après une première validation de PIN réussie. En cas d'inactivité ou d'échecs répétés, l'application se verrouille automatiquement.

### 2.2 Règles de Gestion (RG-AUTH)
- **`[RG-AUTH-01]`** : Le code PIN doit comporter exclusivement des chiffres (entre 4 et 6 caractères).
- **`[RG-AUTH-02]`** : Le PIN est systématiquement haché avec l'algorithme `bcrypt` (facteur de coût 10) avant stockage local ou distant. Aucun PIN n'est jamais stocké ni transmis en clair.
- **`[RG-AUTH-03]`** : Après 5 tentatives consécutives de PIN échouées, l'application se verrouille pour une durée de 15 minutes avec compte à rebours visible.
- **`[RG-AUTH-04]`** : Après 3 périodes successives de blocage de 15 minutes, l'accès requiert obligatoirement le fichier de récupération d'urgence chiffré généré à l'installation.
- **`[RG-AUTH-05]`** : L'authentification biométrique ne peut être activée que si une session PIN active a été préalablement validée.
- **`[RG-AUTH-06]`** : En cas d'échec de la reconnaissance biométrique, le système bascule sans délai sur l'écran de saisie du PIN.
- **`[RG-AUTH-07]`** : L'application se verrouille automatiquement après un délai configurable d'inactivité (par défaut : 5 minutes).
- **`[RG-AUTH-08]`** : Toute action de déblocage d'urgence ou de réinitialisation génère automatiquement une entrée dans le journal d'audit (`audit_logs`) avec l'action `emergency_unlock`.

### 2.3 Cas d'Utilisation : UC-AUTH-01 — Connexion par PIN
- **Acteur Principal** : Patron (`OWNER`), Vendeur (`SELLER`), Caissier (`CASHIER`).
- **Précondition** : L'application est installée et verrouillée.
- **Flux Nominal** :
  1. L'application affiche l'écran de verrouillage avec le nom et logo de la boutique active.
  2. L'utilisateur saisit son code PIN sur le pavé numérique sécurisé.
  3. Le système compare le hash du PIN saisi avec le hash stocké.
  4. Si concordance : déverrouillage immédiat, mise à jour de `last_login_at` et redirection vers le Tableau de Bord.
- **Flux Alternatifs** :
  - *PIN erroné* : Affichage du message `[ERR-AUTH-01]` indiquant le nombre d'essais restants.
  - *5ème échec consécutif* : Verrouillage temporaire de 15 minutes avec affichage d'un minuteur actif.

---

## 3. Module 2 : Tableau de Bord & Indicateurs en Temps Réel

### 3.1 Description Générale
Le Tableau de Bord est l'écran d'accueil immédiat après authentification. Il offre une vision consolidée de la performance du jour pour la boutique active, calculée en temps réel à partir de la base SQLite locale.

```
┌─────────────────────────────────────────────────────────────┐
│ 🏪 BOUTIQUE CENTRALE — DANTOKPA                             │
├─────────────────────────────────────────────────────────────┤
│ 💰 CHIFFRE D'AFFAIRES DU JOUR                               │
│    245 000 FCFA       [ 18 Ventes | Panier moyen: 13 610 F ]│
├──────────────────────────────┬──────────────────────────────┤
│ 💵 Encaissé : 195 000 FCFA   │ 📒 En Crédit : 50 000 FCFA   │
├──────────────────────────────┼──────────────────────────────┤
│ ⚠️ Alertes Stock : 4 Produits│ 👥 Dettes Dues : 380 000 FCFA │
├──────────────────────────────┴──────────────────────────────┤
│ 🕒 DERNIÈRES TRANSACTIONS                                   │
│ • REC-20260228-0018  14:32  Riz 25kg x2       28 000 F (Cash)│
│ • REC-20260228-0017  14:15  Huile 5L x1       12 500 F (MoMo)│
│ • REC-20260228-0016  13:50  Sucre x5          15 000 F (Créd)│
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Règles de Gestion (RG-DB)
- **`[RG-DB-01]`** : Le chiffre d'affaires du jour agrège toutes les ventes non annulées de 00h00 à l'heure courante pour la boutique active (`shop_id`).
- **`[RG-DB-02]`** : Les ventes annulées (`status = 'cancelled'`) sont rigoureusement exclues de tous les cumuls et graphiques.
- **`[RG-DB-03]`** : Le badge "Alertes Stock" affiche le nombre de références dont la `quantity_in_stock <= alert_threshold`.
- **`[RG-DB-04]`** : Le badge "Créances Dues" affiche la somme cumulée des soldes restants (`remaining_amount`) de toutes les dettes aux statuts `open` et `partial`.
- **`[RG-DB-05]`** : Le bénéfice estimé de la journée n'est calculé et affiché que si au moins un article vendu dispose d'un prix d'achat (`price_buy`) renseigné.

---

## 4. Module 3 : Gestion de l'Inventaire, Catégories & Lots

### 4.1 Description Générale
Ce module gère le catalogue des produits, les catégories, les variations tarifaires, les stocks actuels, le suivi par lots et l'historique complet de tous les mouvements.

### 4.2 Règles de Gestion (RG-INV)
- **`[RG-INV-01]`** : Le nom du produit est obligatoire (au moins 2 caractères) et unique par boutique.
- **`[RG-INV-02]`** : Le prix de vente (`price_sell`) est obligatoire et doit être un entier strictement positif en FCFA.
- **`[RG-INV-03]`** : Le prix d'achat (`price_buy`) est optionnel. S'il est saisi, il doit être strictement supérieur à 0 et inférieur au prix de vente.
- **`[RG-INV-04]`** : La quantité en stock ne peut **jamais être négative**. Toute tentative de vente ou d'ajustement entraînant un stock < 0 est bloquée par l'application avec un message explicite `[ERR-INV-01]`.
- **`[RG-INV-05]`** : Un produit ne peut jamais être supprimé physiquement de la base s'il a déjà fait l'objet d'au moins une vente, d'un mouvement ou d'un transfert. Il est uniquement archivé logiquement (`is_deleted = 1`).
- **`[RG-INV-06]`** : Tout ajustement manuel de stock (inventaire, casse, perte, vol) requiert obligatoirement la sélection d'un motif et génère un enregistrement immuable dans `stock_movements` et `audit_logs`.
- **`[RG-INV-07]`** : La modification ultérieure du prix d'un produit n'affecte en aucun cas les ventes passées, qui conservent le prix unitaire photographié au moment de la transaction (`unit_price_snapshot`).
- **`[RG-INV-08] 🆕`** : En cas de gestion par lots (`product_lots`), les sorties de stock suivent prioritairement la méthode **FEFO** (First Expired, First Out) selon la date limite de consommation (DLC).

---

## 5. Module 4 : Gestion des Ventes, Caisse & Reçus

### 5.1 Description Générale
Le module de vente est le cœur opérationnel. Il propose deux modes de saisie :
1. **Mode Standard** : Panier détaillé avec recherche de produits par nom/code-barres, réglage des quantités, application de remises, choix du client et détails de paiement.
2. **Mode Rapide (Vente Express)** : Saisie directe d'un montant total en FCFA pour les périodes de forte affluence (n'impacte pas le stock détaillé).

### 5.2 Règles de Gestion (RG-VTE)
- **`[RG-VTE-01]`** : En mode standard, un panier doit contenir au moins un article avec une quantité strictement positive pour être validé.
- **`[RG-VTE-02]`** : Une remise globale ou par ligne ne peut jamais excéder le montant total de la commande (le total après remise ne peut être négatif).
- **`[RG-VTE-03]`** : L'association d'un client est facultative pour un paiement au comptant, mais **strictement obligatoire pour tout paiement à crédit ou mixte**.
- **`[RG-VTE-04]`** : Le numéro de reçu suit le format normalisé `REC-YYYYMMDD-NNNN` avec réinitialisation quotidienne du compteur à minuit.
- **`[RG-VTE-05]`** : La validation de la vente s'effectue dans une transaction atomique locale comprenant : l'insertion dans `sales`, l'insertion des lignes dans `sale_items`, la décrémentation de `products.quantity_in_stock`, l'insertion dans `stock_movements` et la création éventuelle dans `debts`.
- **`[RG-VTE-06]`** : Une vente peut être annulée **uniquement dans un délai maximal de 24 heures** après sa création, exclusivement par le rôle `OWNER`, avec saisie obligatoire d'un motif d'au moins 5 caractères.
- **`[RG-VTE-07]`** : L'annulation d'une vente standard restitue immédiatement et intégralement les quantités en stock et annule la dette correspondante si aucun acompte n'a encore été versé. Si des acomptes ont déjà été enregistrés, l'annulation directe est bloquée au profit d'un avoir/remplacement.

---

## 6. Module 5 : Gestion des Paiements & Monnaie

### 6.1 Description Générale
Prend en charge tous les modes de règlement en usage au Bénin et assure la cohérence des encaissements.

### 6.2 Règles de Gestion (RG-PAY)
- **`[RG-PAY-01]`** : Les modes de paiement acceptés sont : `cash` (Espèces), `mtn_momo` (MTN Mobile Money), `moov_money` (Moov Money), `credit` (Vente à crédit), `mixed` (Paiement combiné).
- **`[RG-PAY-02]`** : En cas de paiement en espèces supérieur au total dû, le système calcule et affiche en gros caractères la monnaie exacte à restituer.
- **`[RG-PAY-03]`** : Pour tout paiement Mobile Money, le champ référence de transaction ou numéro de téléphone de l'émetteur peut être consigné pour vérification comptable.
- **`[RG-PAY-04]`** : L'égalité financière fondamentale `amount_paid + amount_credit = total_amount` doit être vérifiée au centime près avant validation de toute vente.
- **`[RG-PAY-05] 🆕`** : Lors de la synchronisation de paiements saisis hors-ligne sur des appareils multiples, tous les encaissements sont cumulés de manière **additive** : aucun paiement ne peut être écrasé.

---

## 7. Module 6 : Gestion des Clients & Répertoire Commercial

### 7.1 Description Générale
Centralise le fichier client avec historique d'achats, solde des créances en cours, coordonnées géographiques et raccourcis de communication directe.

### 7.2 Règles de Gestion (RG-CLI)
- **`[RG-CLI-01]`** : Le nom du client est obligatoire (minimum 2 caractères).
- **`[RG-CLI-02]`** : Le numéro de téléphone est vivement recommandé au format national béninois (+229 XX XX XX XX) ou international.
- **`[RG-CLI-03]`** : Le solde débiteur (`balance_due`) affiché sur la fiche client correspond à la somme temps réel de ses dettes non soldées.
- **`[RG-CLI-04]`** : Un client ayant une dette ouverte (`balance_due > 0`) ne peut pas être archivé.
- **`[RG-CLI-05]`** : L'application permet d'ouvrir directement l'application **WhatsApp** avec un message personnalisé et pré-rempli rappelant poliment le montant de la créance due et les coordonnées de la boutique.

---

## 8. Module 7 : Gestion des Dettes, Recouvrement & Pardon

### 8.1 Description Générale
Module stratégique pour le contexte commercial africain, transformant le suivi informel des créances en un processus rigoureux et transparent.

```
┌─────────────────────────────────────────────────────────────┐
│ 📒 FICHE DETTE — DET-20260215-0042                          │
├─────────────────────────────────────────────────────────────┤
│ Client : Amina SOSSOU (+229 97 00 11 22)                    │
│ Date Création : 15 Fév 2026 (il y a 13 jours)                │
│ Vente Liée : REC-20260215-0089 (Riz, Huile, Savon)          │
├─────────────────────────────────────────────────────────────┤
│ Montant Initial : 45 000 FCFA                               │
│ Montant Déjà Remboursé : 20 000 FCFA                        │
│ 🔴 SOLDE RESTANT DÛ : 25 000 FCFA                           │
│ [████████████████████░░░░░░░░░░░░░░░░░░░░] 44% Soldé        │
├─────────────────────────────────────────────────────────────┤
│ 📜 HISTORIQUE DES ENCAISSEMENTS                             │
│ • 20 Fév 2026  10:00  10 000 F (Espèces) — Enregistré p/Kofi│
│ • 24 Fév 2026  16:30  10 000 F (MTN MoMo) — Enregistré p/Kofi│
├─────────────────────────────────────────────────────────────┤
│ [ 💵 Enregistrer un Acompte ]   [ 💬 Relance WhatsApp ]     │
│ [ ... Menu Patron : Pardonner cette Dette ]                 │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Règles de Gestion (RG-DET)
- **`[RG-DET-01]`** : Le montant initial d'une dette (`original_amount`) est strictement **immuable** après création.
- **`[RG-DET-02]`** : Tout remboursement partiel décrémente instantanément `remaining_amount` et met à jour `customers.balance_due`.
- **`[RG-DET-03]`** : Lorsque `remaining_amount = 0`, le statut passe automatiquement à `paid` et une notification locale de félicitations est émise.
- **`[RG-DET-04]`** : Le patron (`OWNER`) a la faculté de **pardonner** une dette (*geste commercial ou créance irrécouvrable*). Cette action est irréversible, nécessite la saisie obligatoire d'un motif d'au moins 10 caractères et génère une entrée d'audit détaillée (`action = 'debt_forgiven'`).
- **`[RG-DET-05]`** : Une dette sans aucun remboursement depuis plus de 30 jours est automatiquement marquée en **Alerte Critique** (couleur rouge pulsante et notification périodique).

---

## 9. Module 8 : Sessions de Caisse (Cash Management)

### 9.1 Description Générale
Assure le contrôle physique et théorique des flux d'espèces en caisse, depuis l'ouverture du matin jusqu'à la clôture du soir.

### 9.2 Règles de Gestion (RG-CS)
- **`[RG-CS-01]`** : Un utilisateur vendeur ou caissier ne peut enregistrer de vente en espèces sans qu'une session de caisse ne soit préalablement ouverte pour sa boutique.
- **`[RG-CS-02]`** : À l'ouverture, l'utilisateur déclare le fond de caisse initial en espèces (`opening_amount`).
- **`[RG-CS-03]`** : Les encaissements en espèces des ventes s'ajoutent automatiquement au montant théorique de la session.
- **`[RG-CS-04]`** : Les dépenses payées en espèces depuis la caisse décrémentent le montant théorique de la session.
- **`[RG-CS-05]`** : À la clôture, l'utilisateur saisit le comptage physique réel des billets et pièces (`closing_amount_counted`). Le système calcule automatiquement l'écart :
  $$\text{Écart} = \text{Montant Compté} - (\text{Fond Initial} + \text{Entrées Espèces} - \text{Sorties Espèces})$$
- **`[RG-CS-06]`** : Tout écart supérieur au seuil de tolérance (par défaut 500 FCFA) requiert obligatoirement la saisie d'un commentaire explicatif et une notification d'alerte immédiate au Patron.

---

## 10. Module 9 : Gestion des Dépenses & Charges Courantes

### 10.1 Description Générale
Permet de consigner toutes les sorties de fonds liées au fonctionnement de la boutique (loyer, facture SBEE, facture SONEB, transport de marchandises, ration du personnel, emballages).

### 10.2 Règles de Gestion (RG-EXP)
- **`[RG-EXP-01]`** : Chaque dépense doit obligatoirement être rattachée à une catégorie de dépense active (`expense_categories`).
- **`[RG-EXP-02]`** : Le montant de la dépense doit être un entier strictement positif en FCFA.
- **`[RG-EXP-03]`** : Si la dépense est payée depuis la caisse de la boutique, elle est automatiquement associée à la session de caisse en cours et déduite du solde théorique d'espèces.
- **`[RG-EXP-04]`** : L'utilisateur peut photographier le reçu papier ou la facture justificative via la caméra pour archivage local.

---

## 11. Module 10 : Approvisionnements & Gestion des Fournisseurs

### 11.1 Description Générale
Gère les commandes d'achat auprès des grossistes et importateurs, les réceptions physiques et le suivi des litiges de livraison.

### 11.2 Règles de Gestion (RG-PROC)
- **`[RG-PROC-01]`** : Une commande fournisseur enregistre la liste des articles commandés avec quantités et prix d'achat convenus.
- **`[RG-PROC-02]`** : Lors de la réception de livraison, le magasinier ou gérant effectue un pointage article par article : quantité reçue conforme, quantité manquante ou quantité refusée (avarie/casse).
- **`[RG-PROC-03]`** : La validation de la réception incrémente immédiatement le stock de la boutique et enregistre un mouvement de stock de type `restock`.
- **`[RG-PROC-04]`** : Pour tout article refusé, un motif précis de non-conformité est consigné et un bon de refus/litige PDF peut être émis.

---

## 12. Module 11 : Transferts de Stock Inter-Boutiques

### 12.1 Description Générale
Gère le déplacement sécurisé de marchandises entre un entrepôt central et des boutiques satellites, ou entre points de vente d'un même réseau commercial.

```
┌─────────────────────────────────────────────────────────────┐
│             FLUX DE TRANSFERT INTER-BOUTIQUES               │
├─────────────────────────────────────────────────────────────┤
│ 1. ÉMISSION (Boutique Source)                               │
│    • Saisie des articles et quantités à transférer          │
│    • Décrément immédiat du stock source (Mouvement: `out`)  │
│    • Statut: `in_transit` (Colis scellé avec bordereau)     │
├─────────────────────────────────────────────────────────────┤
│ 2. TRANSIT (Transporteur / Chauffeur)                       │
│    • Numéro de suivi et nom du transporteur consigné       │
├─────────────────────────────────────────────────────────────┤
│ 3. RÉCEPTION (Boutique Destinataire)                        │
│    • Pointage contradictoire à l'arrivée                    │
│    • Si conforme -> Incrément stock cible (Statut: `received`)│
│    • Si anomalie/manquant -> Déclaration litige tracé audit │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Règles de Gestion (RG-TRSF)
- **`[RG-TRSF-01]`** : Un transfert ne peut être initié que si la boutique source dispose du stock suffisant.
- **`[RG-TRSF-02]`** : Dès la validation de l'expédition, le stock de la boutique source est débité pour éviter toute double vente. La marchandise est comptabilisée au statut "En transit".
- **`[RG-TRSF-03]`** : La boutique réceptrice doit obligatoirement effectuer un pointage de réception pour intégrer les articles dans son stock actif.

---

## 13. Module 12 : Commandes Clients & Préparation de Livraison

### 13.1 Description Générale
Permet de prendre des commandes à l'avance pour des clients importants (entreprises, cérémonies, chantiers) et de gérer les livraisons partielles avec suivi des reliquats.

### 13.2 Règles de Gestion (RG-ORD)
- **`[RG-ORD-01]`** : Une commande client passe par les statuts successifs : `draft` (brouillon) $\rightarrow$ `confirmed` (confirmée) $\rightarrow$ `preparing` (en préparation) $\rightarrow$ `partially_delivered` (partiellement livrée) $\rightarrow$ `delivered` (totalement livrée) $\rightarrow$ `cancelled` (annulée).
- **`[RG-ORD-02]`** : Les articles préparés font l'objet d'une réservation de stock.
- **`[RG-ORD-03]`** : En cas de livraison partielle, le système génère un bordereau de livraison pour les articles remis et conserve automatiquement un état des reliquats à livrer ultérieurement.

---

## 14. Module 13 : Bureau de Change (Opérations FX)

### 14.1 Description Générale
Conçu pour les commerces situés dans des zones frontalières (ex: frontière Nigéria / Sèmè-Kraké, Hilacondji) ou les grands pôles de négoce manipulant le Naira nigérian (NGN), l'Euro (EUR) ou le Dollar US (USD).

### 14.2 Règles de Gestion (RG-FX)
- **`[RG-FX-01]`** : Avant toute opération de change, une session de change quotidienne doit être initialisée avec la fixation des cours d'achat (`buy_rate`) et des cours de vente (`sell_rate`) par devise.
- **`[RG-FX-02]`** : L'enregistrement d'une opération de change calcule instantanément la contre-valeur en FCFA et le gain de change brut théorique.
- **`[RG-FX-03]`** : Un reçu d'opération de change mentionnant la devise, le cours appliqué, les montants échangés et l'identité du client est émis.

---

## 15. Module 14 : Simulateurs & Outils de Calcul Commercial

### 15.1 Description Générale
Mise à disposition du commerçant d'outils d'aide à la décision :
- **Calculateur de Marge & Prix de Vente Cible** : Détermination du prix de vente optimal en fonction du coût de revient et de la marge souhaitée (en % ou montant).
- **Simulateur de Seuil de Rentabilité (Point Mort)** : Calcul du volume de vente journalier requis pour couvrir les charges fixes de la boutique.
- **Calculateur de Remise Commerciale** : Simulation de l'impact d'un rabais sur le bénéfice net.

---

## 16. Module 15 : Rapports Financiers, Statistiques & Analyses

### 16.1 Description Générale
Moteur d'analyse décisionnelle calculant instantanément les indicateurs clés de performance (KPIs) sur toute période sélectionnée (Jour, Semaine, Mois, Trimestre, Année, Période personnalisée).

### 16.2 Règles de Gestion (RG-STAT)
- **`[RG-STAT-01]`** : Les indicateurs calculés comprennent :
  - **Chiffre d'Affaires Brut & Net** (après déduction des remises).
  - **Montant Réellement Encaissé vs Créances Nouvelles Accordées**.
  - **Bénéfice Brut Réalisé** : $\sum (\text{Prix Vente} - \text{Prix Achat}) \times \text{Quantité Vendue}$.
  - **Taux de Recouvrement des Dettes** : $\frac{\text{Acomptes Encaissés sur la Période}}{\text{Dettes Créées sur la Période}} \times 100$.
  - **Top 10 des Produits les Plus Rentables et les Plus Vendus**.
  - **Performance Individuelle des Vendeurs** (Chiffre d'affaires généré par utilisateur).
- **`[RG-STAT-02]`** : Tous les rapports peuvent être exportés directement en document PDF imprimable ou partagé via WhatsApp, 100% hors-ligne.

---

## 17. Module 16 : Notifications Intelligentes Locales & Sonores

### 17.1 Description Générale
Système d'alertes proactives générées localement par le terminal sans nécessiter de serveur cloud (`flutter_local_notifications`). Le système garantit un déclenchement fiable **même lorsque l'application est totalement fermée**, avec **émission d'un signal sonore audible** et vibrations.

### 17.2 Règles de Gestion (RG-NOTIF)
- **`[RG-NOTIF-01]`** : Toutes les notifications fonctionnent de manière 100% autonome et locale sans aucune dépendance à une connexion Internet ou à un service push cloud tiers.
- **`[RG-NOTIF-02]` 🆕 (Déclenchement Hors-Application)** : Les notifications planifiées (rappels quotidiens de dettes, résumé journalier à 20h00, alertes de stock critique) doivent obligatoirement être programmées via le gestionnaire d'alarmes du système d'exploitation (`zonedSchedule` / AlarmManager) afin de **s'afficher et retentir même si l'application a été quittée, fermée ou placée en arrière-plan**.
- **`[RG-NOTIF-03]` 🆕 (Alerte Sonore & Vibrations Audibles)** : Chaque notification est émise avec un **signal sonore audible** (`playSound: true`) et une vibration physique (`enableVibration: true`). Les canaux de notification Android sont configurés en **Haute Importance** (`importance: Importance.high`, `priority: Priority.high`) pour garantir la captation de l'attention du commerçant dans l'ambiance sonore du marché.
- **`[RG-NOTIF-04]`** : Le tap sur une notification effectue un routage immédiat (*Deep Linking*) vers l'écran concerné (ex: tap sur une alerte dette $\rightarrow$ ouverture directe de la fiche client/dette).
- **`[RG-NOTIF-05]`** : L'alerte de conflit de synchronisation ou de créance critique $> 30$ jours ne peut pas être masquée afin de protéger la sécurité financière du commerce.

### 17.3 Catalogue des Notifications
| Code | Événement Déclencheur | Titre & Contenu de l'Alerte | Canal & Son | Priorité |
| :--- | :--- | :--- | :---: | :---: |
| **`NOTIF-01`** | Stock produit $\le$ seuil d'alerte | ⚠️ **Stock Faible** : Il ne reste que *X* unités de *[Produit]*. | `venteapp_stock` (Sonore) | Haute |
| **`NOTIF-02`** | Dette sans mouvement $> 30$ jours | 📒 **Rappel Créance** : Le client *[Nom]* a une dette de *[Montant]* F en souffrance. | `venteapp_debt` (Sonore) | Haute |
| **`NOTIF-03`** | Heure configurée (20h00 par défaut) | 📊 **Résumé du Jour** : CA réalisé aujourd'hui : *[Total]* FCFA (*[N]* ventes). | `venteapp_summary` (Sonore) | Normale |
| **`NOTIF-04`** | Remboursement final d'une dette | ✅ **Dette Soldée** : Félicitations ! *[Client]* a entièrement soldé sa dette. | `venteapp_debt` (Sonore) | Haute |
| **`NOTIF-05`** | Absence de sauvegarde $> 7$ jours | 💾 **Sauvegarde Recommandée** : Pensez à exporter vos données de sécurité. | `venteapp_system` (Sonore) | Haute |
| **`NOTIF-06`** | Détection d'un conflit de sync | 🔄 **Conflit de Données** : Une modification concurrente requiert votre arbitrage. | `venteapp_sync` (Sonore) | Critique |

---

## 18. Module 17 : Audit & Journal des Actions Sensibles (Audit Trail)

### 18.1 Description Générale
Le module d'audit garantit la transparence absolue et la lutte contre la fraude interne en répondant à la règle d'or : **Qui a fait quoi, quand, sur quelle donnée et pour quel motif ?**

### 18.2 Règles de Gestion (RG-AUD)
- **`[RG-AUD-01]`** : L'accès à la consultation du journal d'audit est réservé exclusivement au rôle `OWNER` (Patron).
- **`[RG-AUD-02]`** : La table `audit_logs` est en mode **append-only strict** : aucune modification ni suppression de log n'est permise.
- **`[RG-AUD-03]`** : Sont obligatoirement et automatiquement consignées :
  - La création, le remboursement partiel, le pardon et l'annulation d'une dette.
  - L'annulation d'une vente et son motif.
  - Tout ajustement manuel de stock avec motif.
  - Toute modification du prix de vente ou d'achat d'un produit (avec capture de l'ancienne et nouvelle valeur en JSON).
  - L'archivage d'un client ou d'un produit.
  - Les déblocages d'urgence par PIN de secours.
  - Les arbitrages manuels de conflits de synchronisation.
- **`[RG-AUD-04]`** : Le journal d'audit peut être exporté en document PDF certifié en cas de litige judiciaire ou prud'homal.

---

## 19. Module 18 : Multi-Boutiques, Forfaits & Paramètres

### 19.1 Description Générale
Structure le modèle de données pour permettre la gestion d'un commerce unique (V1) ou d'un réseau commercial multi-sites (V3) avec isolation étanche des données et gestion transparente des offres.

### 19.2 Règles de Gestion (RG-SHOP & RG-LIC)
- **`[RG-SHOP-01]`** : En version mono-boutique (V1), une boutique par défaut (`shop_id = 1`) est générée de manière transparente sans friction pour l'utilisateur.
- **`[RG-SHOP-02]`** : En version multi-boutiques (V3), le patron peut créer et piloter N boutiques avec des catalogues indépendants ou partagés.
- **`[RG-SHOP-03]`** : La devise de base du système est fixée au Franc CFA (`FCFA / XOF`).
- **`[RG-SHOP-04]`** : L'écran de sauvegarde permet de générer un fichier chiffré `.venteapp` téléchargeable ou d'activer la synchronisation automatique Google Drive / Cloud Supabase.
- **`[RG-SHOP-05]` 🆕 (Forfait Gratuit Automatique à l'Installation)** : À l'installation et au premier lancement de l'application, l'offre attribuée par défaut est automatiquement le forfait **GRATUIT (Starter)** à **0 FCFA à vie** :
  - Périmètre : 1 Boutique, 1 Utilisateur (Patron).
  - Mode : 100% Offline Local (Ventes Standard & Rapide, Catalogue & Stocks, Dettes & Recouvrement, Reçus WhatsApp/Tickets, Notifications sonores).
  - Aucune limitation de durée, aucun numéro de carte bancaire requis. Le passage aux forfaits PRO (5 000 F/mois) ou ENTREPRISE (15 000 F/mois) relève d'une souscription volontaire ultérieure.

---

## 20. Catalogue des Codes d'Erreur Applicatifs

| Code Erreur | Module | Condition Déclenchante | Message Utilisateur |
| :--- | :--- | :--- | :--- |
| **`ERR-AUTH-01`** | Auth | PIN saisi erroné | *"Code PIN incorrect. Il vous reste {N} tentative(s)."* |
| **`ERR-AUTH-02`** | Auth | Dépassement 5 tentatives | *"Application bloquée pendant 15 minutes par sécurité."* |
| **`ERR-INV-01`** | Stock | Vente supérieure au stock | *"Stock insuffisant ! Il ne reste que {N} unité(s) de '{PRODUIT}'."* |
| **`ERR-INV-02`** | Stock | Prix de vente $\le 0$ | *"Le prix de vente doit être un montant supérieur à 0 FCFA."* |
| **`ERR-INV-03`** | Stock | Prix achat $>$ prix vente | *"Le prix d'achat ne peut pas dépasser le prix de vente."* |
| **`ERR-VTE-01`** | Vente | Panier vide | *"Veuillez ajouter au moins un produit pour valider la vente."* |
| **`ERR-VTE-02`** | Vente | Crédit sans client | *"Veuillez sélectionner un client pour enregistrer une vente à crédit."* |
| **`ERR-VTE-03`** | Vente | Annulation $> 24h$ | *"L'annulation d'une vente est impossible au-delà de 24 heures."* |
| **`ERR-DET-01`** | Dette | Remboursement trop élevé | *"Le montant saisi ({SAISI} F) dépasse le solde dû ({DU} F)."* |
| **`ERR-DET-02`** | Dette | Motif de pardon trop court | *"Le motif de pardon de dette doit comporter au moins 10 caractères."* |
| **`ERR-CS-01`** | Caisse | Vente sans session active | *"Veuillez ouvrir la session de caisse avant de commencer les ventes."* |
| **`ERR-SYS-01`** | Système | Espace disque saturé | *"Espace de stockage insuffisant. Veuillez libérer de l'espace."* |
| **`ERR-SYS-02`** | Système | Sauvegarde corrompue | *"Le fichier de sauvegarde est invalide ou corrompu."* |
