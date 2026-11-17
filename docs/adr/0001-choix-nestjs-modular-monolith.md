# ADR 0001 — Choix de l'Architecture Monolithe Modulaire avec NestJS

## Statut
Accepté

## Contexte
ARIKE doit servir de plateforme de synchronisation, de gestion des abonnements, de distribution des mises à jour logicielles et de supervision multi-boutiques. L'équipe a évalué deux approches :
1. Une architecture en microservices distribués (Auth Service, Catalog Service, Sales Service, Sync Service).
2. Une architecture en Monolithe Modulaire avec **NestJS 11** et TypeScript.

## Décision
Nous avons adopté l'approche **Monolithe Modulaire** basée sur NestJS pour les raisons suivantes :
- **Facilité d'Exploitation** : Un seul artefact déployable (conteneur Docker ou instance Node.js unique), ce qui réduit drastiquement les coûts d'infrastructure et élimine la complexité réseau inter-services.
- **Frontières de Domaines Claires** : NestJS force l'encapsulation par modules (`@Module`). Chaque domaine (Ventes, Stocks, Caisses, Dettes) possède ses propres contrôleurs, services et DTOs.
- **Communication Inter-Modules Découplée** : Utilisation de `@nestjs/event-emitter` pour les flux asynchrones (ex : enregistrement d'une vente déclenchant l'audit, la mise à jour des caisses et la vérification des alertes stocks).
- **Évolutivité Future** : Si un domaine critique nécessite ultérieurement un scaling horizontal dédié (ex : le moteur de synchronisation), son code est déjà isolé et peut être extrait sans refactorisation lourde.

## Conséquences
- Déploiement et débogage extrêmement rapides.
- Zéro latence réseau interne entre les fonctionnalités métier.
- Nécessité d'une rigueur d'équipe pour ne pas importer directement des services privés d'autres modules sans passer par les interfaces exportées ou les événements.

