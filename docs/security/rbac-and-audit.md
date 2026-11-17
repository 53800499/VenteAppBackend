# Contrôle d'Accès RBAC & Piste d'Audit Inviolable

Ce document décrit l'implémentation technique des permissions et de la traçabilité d'audit dans ARIKE.

---

## 1. Décorateurs de Permissions (`@RequirePermissions`)

Dans les contrôleurs NestJS, les endpoints sensibles sont protégés de manière déclarative :

```typescript
@Post(':id/approve')
@RequirePermissions(Permission.CASH_SESSIONS_APPROVE)
@UseGuards(JwtAuthGuard, PermissionsGuard)
async approveSession(
  @Param('id') id: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.cashSessionsService.approve(id, user.id);
}
```

---

## 2. Table `audit_logs` (Journal d'Audit Immuable)

Chaque événement sensible déclenché par un utilisateur est automatiquement journalisé dans la table `audit_logs` :
- `id` : UUID
- `tenant_id` : UUID
- `shop_id` : UUID
- `user_id` : UUID de l'opérateur
- `action` : `SALE_DELETED`, `CASH_DISCREPANCY_APPROVED`, `PRICE_CHANGED`, `STOCK_ADJUSTED`
- `entity_type` : `sale`, `cash_session`, `product`
- `old_values` : JSON de l'état avant action
- `new_values` : JSON de l'état après action
- `ip_address` & `user_agent` : Données de traçabilité réseau

Cette table est configurée en **Append-Only** (interdiction stricte des requêtes `UPDATE` et `DELETE` via trigger PostgreSQL).

