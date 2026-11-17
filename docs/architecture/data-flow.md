# Flux de Données Critiques du Backend

Ce document documente les flux d'informations de bout en bout pour les scénarios les plus sensibles du système.

---

## 1. Flux d'Authentification & Émission de Jetons

```mermaid
sequenceDiagram
    autonumber
    actor Client as Client Mobile / Desktop
    participant AuthCtrl as AuthController
    participant AuthService as AuthService
    participant DB as PostgreSQL (Supabase)

    Client->>AuthCtrl: POST /auth/login (téléphone, mot de passe, empreinte appareil)
    AuthCtrl->>AuthService: login(dto)
    AuthService->>DB: Recherche utilisateur par téléphone
    DB-->>AuthService: Données utilisateur + Hash mot de passe
    AuthService->>AuthService: Vérifie bcrypt.compare(motDePasse, hash)
    Note over AuthService: Génère Access Token JWT (1h) & Refresh Token (90j)
    AuthService->>DB: Enregistre le Refresh Token et la session appareil
    AuthService-->>AuthCtrl: Jeton JWT + Profil + Boutiques autorisées
    AuthCtrl-->>Client: Réponse HTTP 200
```

---

## 2. Flux de Clôture de Caisse avec Écart

```mermaid
sequenceDiagram
    autonumber
    actor Caissier as Caissier
    participant CashCtrl as CashSessionsController
    participant CashService as CashSessionsService
    participant DB as PostgreSQL (Supabase)
    actor Gerant as Gérant / Propriétaire

    Caissier->>CashCtrl: POST /cash-sessions/close (montant réel compté, motif de l'écart)
    CashCtrl->>CashService: closeSession(dto)
    CashService->>DB: Calcule solde théorique = fond + ventes + apports - sorties
    CashService->>CashService: Calcule écart = réel - théorique
    
    alt Écart = 0 F
        CashService->>DB: Statut = 'CLOSED', closed_at = NOW()
        CashService-->>CashCtrl: Caisse clôturée avec succès
    else Écart != 0 F ET PIN Gérant fourni
        CashService->>DB: Valide le PIN du gérant avec la permission cash_sessions.approve
        CashService->>DB: Statut = 'CLOSED', verified_by = gerant_id
        CashService-->>CashCtrl: Caisse clôturée avec approbation d'écart
    else Écart != 0 F SANS PIN Gérant
        CashService->>DB: Statut = 'PENDING_APPROVAL'
        CashService-->>CashCtrl: Caisse mise en attente de validation par le gérant
        Note over Gerant: Reçoit une notification d'approbation requise
    end
```

