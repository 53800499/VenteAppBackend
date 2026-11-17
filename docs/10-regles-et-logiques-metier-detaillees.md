# 10 — Règles de Gestion & Logiques Métier Détaillées du Backend

Ce document consigne les **formules mathématiques, algorithmes, contraintes d'intégrité et règles de gestion** qui régissent l'intégralité du système backend **ARIKE**.

---

## 1. Gestion de Caisse & Rigueur Financière

### 1.1 Formule du Solde Théorique de Caisse Attendu
Le solde d'espèces attendu en caisse à la clôture n'est jamais une valeur arbitraire. Il est calculé de manière déterministe :

$$\text{Solde Espèces Attendu} = \text{Fond Initial} + \sum \text{Ventes Espèces} + \sum \text{Règlements Dettes Espèces} + \sum \text{Apports (INTAKE)} - \sum \text{Versements Coffre (DROP)} - \sum \text{Dépenses en Caisse (EXPENSE)}$$

Pour les encaissements dématérialisés :
$$\text{Solde MoMo Attendu} = \sum \text{Ventes MoMo/Moov} + \sum \text{Règlements Dettes MoMo}$$

### 1.2 Algorithme de Calcul de l'Écart & Tolérance Zéro
$$\text{Écart constaté} = \text{Montant Réel Déclaré} - \text{Montant Théorique Attendu}$$

- **Règle 1 (Écart = 0 F)** : La caisse est parfaitement équilibrée. Statut immédiat : `CLOSED`.
- **Règle 2 (Écart < 0 F — Déficit)** : Il manque physiquement de l'argent.
  - Le système rend **obligatoire** la saisie d'un texte d'explication (`discrepancy_reason`).
  - Le système exige le code PIN du propriétaire/gérant (`verified_by_user_id`) OU bascule la session en statut `PENDING_APPROVAL`.
- **Règle 3 (Écart > 0 F — Excédent)** : Surplus physique inexpliqué. Traitement identique à la règle 2 pour prévenir les erreurs de monnaie non rendue aux clients ou les ventes dissimulées.
- **Règle 4 (Supervision Dual-Control)** : Un caissier ne peut pas valider son propre écart anormal à moins de disposer formellement de la permission `cash_sessions.approve` dans son profil utilisateur.

---

## 2. Ventes, Marges Commerciales & Encaissements

### 2.1 Numérotation Séquentielle Inviolable des Tickets
Chaque vente génère un numéro de reçu unique respectant le format :
$$\text{Format : } \#\text{VT}-\text{YYYY}-\text{NNNNN}$$
Exemple : `#VT-2026-00142` (Réinitialisé ou séquentiel continu par boutique, protégé contre les collisions par verrouillage SQL ou UUID client).

### 2.2 Calcul de la Marge Brute par Ligne d'Article
Pour chaque ligne d'article vendue :
$$\text{Coût d'Achat Total Ligne} = \text{Quantité Vendue} \times \text{Prix d'Achat Unitaire (au moment de la vente)}$$
$$\text{Montant Vente Net Ligne} = (\text{Quantité Vendue} \times \text{Prix Vente Unitaire}) - \text{Remise Ligne}$$
$$\text{Marge Brute Ligne} = \text{Montant Vente Net Ligne} - \text{Coût d'Achat Total Ligne}$$
$$\text{Taux de Marge (\%)} = \left( \frac{\text{Marge Brute Ligne}}{\text{Montant Vente Net Ligne}} \right) \times 100$$

### 2.3 Règle des Paiements Mixtes (Split Payments)
Une vente de 45 000 FCFA peut être ventilée en :
- 20 000 FCFA Espèces $\rightarrow$ crédite la caisse physique.
- 15 000 FCFA MTN MoMo $\rightarrow$ crédite le compte Mobile Money.
- 10 000 FCFA Crédit $\rightarrow$ crée automatiquement une créance de 10 000 FCFA sur la fiche du client sélectionné.
Contrainte stricte :
$$\sum \text{Montants Ventilés} = \text{Montant Net à Payer}$$

---

## 3. Valorisation des Stocks & Approvisionnements

### 3.1 Coût Moyen Unitaire Pondéré (CMUP / PAMP)
Lors de chaque réapprovisionnement d'un article, le prix d'achat de référence est recalculé selon la règle comptable du CMUP :

$$\text{Nouveau PAMP} = \frac{(\text{Stock Ancien} \times \text{Ancien PAMP}) + (\text{Quantité Entrante} \times \text{Prix Achat Entrant})}{\text{Stock Ancien} + \text{Quantité Entrante}}$$

### 3.2 Algorithme de Décrémentation Relative Concurrente
Pour éliminer les risques d'écrasement de stock lorsque deux caissiers hors-ligne vendent le même article simultanément :
- Les mutations de synchronisation n'envoient pas `"nouveau_stock = 4"`.
- Les mutations envoient `"delta = -2"` et `"delta = -3"`.
- Le serveur applique : `UPDATE products SET stock = stock - 2 WHERE id = ...` puis `SET stock = stock - 3`.
- Résultat : Cohérence arithmétique garantie à 100%.

### 3.3 Transferts Inter-Boutiques en 3 Étapes
1. **Étape 1 : DEMANDE** : La boutique A demande 10 cartons à la boutique B (Statut `REQUESTED`).
2. **Étape 2 : EXPÉDITION** : La boutique B valide l'envoi. Les 10 cartons sortent immédiatement du stock de B et passent en statut `IN_TRANSIT` (marchandise en cours d'acheminement physique).
3. **Étape 3 : RÉCEPTION** : La boutique A réceptionne le colis, vérifie les quantités physiques et valide. Les articles intègrent le stock disponible de la boutique A (Statut `RECEIVED`).

---

## 4. Dettes Clients & Recouvrements WhatsApp

### 4.1 Plafond Maximal de Crédit
Chaque client possède un `credit_limit` (ex : 100 000 FCFA) :
- Si $\text{Dettes Actives Existantes} + \text{Nouveau Crédit Vente} > \text{Plafond Autorisé}$ :
- L'application refuse la vente à crédit sauf autorisation exceptionnelle par code PIN gérant.

### 4.2 Détection des Créances en Retard (`OVERDUE`)
$$\text{Si } \text{Date du Jour} > \text{Date d'Échéance (due\_date)} \text{ ET } \text{Montant Restant} > 0 \implies \text{Statut = OVERDUE}$$
L'échéance dépassée déclenche :
1. L'affichage en rouge clignotant sur la fiche client.
2. L'apparition prioritaire dans l'onglet **"Créances en Retard"**.
3. La suggestion d'envoi immédiat de la relance WhatsApp.

---

## 5. Bureau de Change (FX Exchange)

Pour les commerces transfrontaliers (Bénin $\leftrightarrow$ Nigeria, Togo, Europe) :
- **Devise de Référence Locale** : FCFA (XOF).
- **Session de Change Dédiée** : Chaque devise étrangère (EUR, USD, NGN) dispose de son propre fond de caisse distinct de la caisse principale en FCFA.
- **Calcul du Spread (Marge de Change)** :
  - Achat de Devises : $\text{FCFA déboursés} = \text{Montant Devise Acheté} \times \text{Taux Achat}$
  - Vente de Devises : $\text{FCFA encaissés} = \text{Montant Devise Vendu} \times \text{Taux Vente}$
  - Bénéfice net réalisé = $\text{Montant Devise} \times (\text{Taux Vente} - \text{Taux Achat})$

---

## 6. Licences Cryptographiques Hors-Ligne (Ed25519)

Pour activer les fonctionnalités PRO chez un commerçant sans Internet :
1. Le SuperAdmin saisit le `tenant_id`, la formule `PRO`, le nombre de boutiques autorisées et la date d'expiration dans le back-office.
2. Le backend génère une signature cryptographique **Ed25519** avec sa clé privée maîtresse.
3. Le commerçant saisit le code de licence (chaîne Base64 de 128 caractères).
4. L'application mobile valide la signature avec la clé publique embarquée dans le binaire Dart.
5. Si la signature est mathématiquement valide, les quotas sont déverrouillés localement pour toute la durée convenue sans aucune connexion réseau requise.
