# Surveillance, Métriques & Journalisation (Monitoring & Logging)

Ce document décrit les outils et procédures d'observabilité du backend ARIKE en production.

---

## 1. Endpoints de Santé Système (Healthchecks)

- **Route** : `GET /api/v1/health`
- **Fréquence de scrutation** : Toutes les 30 secondes par les sondes Docker/Kubernetes.
- **Vérifications automatiques** :
  - Disponibilité et temps de réponse de la base PostgreSQL Supabase (< 150 ms).
  - Utilisation de la mémoire RAM du processus Node.js.
  - Espace disque disponible pour le stockage des APKs de mise à jour.

---

## 2. Journalisation Structurée des Événements (Logging)

Les logs en production sont formatés en JSON standardisé pour ingestion par les outils de collecte (Grafana Loki, ELK, Datadog) :

```json
{
  "timestamp": "2026-11-17T15:30:12.451Z",
  "level": "INFO",
  "context": "CashSessionsService",
  "tenant_id": "987fcdeb-51a2-43bb-a123-222222222222",
  "shop_id": "shop-ganhi-01",
  "user_id": "b1820641-a182-411a-bdc3-111111111111",
  "message": "Session de caisse cs-uuid-001 clôturée avec un écart de 0.00 FCFA.",
  "duration_ms": 24
}
```

