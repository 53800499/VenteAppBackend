# Modèle de Menaces & Durcissement de la Sécurité (Hardening)

Ce document détaille les mesures préventives contre les attaques cybercibles (OWASP Top 10) sur le backend ARIKE.

---

## 1. Protections HTTP & En-têtes de Sécurité

Le backend intègre le middleware **Helmet** qui injecte systématiquement les en-têtes HTTP défensifs :
- `X-Frame-Options: DENY` : Empêche le détournement de clic (Clickjacking).
- `X-Content-Type-Options: nosniff` : Empêche le reniflage de type MIME.
- `Strict-Transport-Security (HSTS)` : Force l'utilisation exclusive de HTTPS pendant 1 an.
- `Content-Security-Policy (CSP)` : Restreint l'exécution de scripts tiers non autorisés.

---

## 2. Prévention des Injections SQL & NoSQL

- L'API n'exécute aucune concaténation directe de chaînes SQL non filtrées.
- Toutes les requêtes passent par le client typé Supabase/PostgreSQL avec requêtes paramétrées natives (`$1, $2, ...`).
- Le `ValidationPipe` global de NestJS rejette immédiatement les charges utiles contenant des caractères non conformes aux DTOs (`forbidNonWhitelisted: true`).

---

## 3. Protection Anti-Brute Force (Rate Limiting)

Pour empêcher les attaques par dictionnaire sur les endpoints d'authentification (`/auth/login`, `/auth/verify-owner-pin`) :
- Limitation stricte à **5 tentatives par minute par adresse IP**.
- En cas de 5 échecs consécutifs sur un même compte, un verrouillage temporaire de 15 minutes est appliqué avec alerte de sécurité dans la table `audit_logs`.

