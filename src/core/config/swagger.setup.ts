import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('VenteApp API')
    .setDescription(
      [
        'API backend **VenteApp Bénin** — gestion commerciale offline-first.',
        '',
        '### Module 1 — Authentification & Sécurité',
        '- Connexion par PIN (UC-01)',
        '- Installation initiale et fichier de récupération (RG-AUTH-08)',
        '- Déblocage d\'urgence (RG-AUTH-04 / RG-AUTH-09)',
        '- Biométrie et gestion de session (RG-AUTH-05 / RG-AUTH-07)',
        '',
        '### Module 2 — Tableau de bord',
        '- Synthèse KPIs du jour (RG-DB-01 à RG-DB-06)',
        '- Données financières réservées au patron (`dashboard:financial`)',
        '',
        '### En-têtes de session',
        'Les routes protégées requièrent :',
        '- `x-session-token` : jeton retourné après connexion PIN réussie',
        '- `x-user-id` : identifiant de l\'utilisateur connecté',
        '',
        '### Format de réponse (module Auth)',
        'Les routes Auth renvoient `{ success, data, timestamp }`.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .setContact('VenteApp', '', 'support@venteapp.bj')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-session-token',
        in: 'header',
        description: 'Jeton de session applicative',
      },
      'session-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-user-id',
        in: 'header',
        description: 'ID utilisateur connecté',
      },
      'user-id',
    )
    .addTag('Application', 'Santé et informations générales de l\'API')
    .addTag('Authentification', 'Module 1 — PIN, biométrie, sessions et déblocage d\'urgence')
    .addTag('Rôles & Permissions', 'Catalogue RBAC et permissions de l\'utilisateur connecté')
    .addTag('Utilisateurs', 'Gestion des vendeurs et lecteurs (patron uniquement)')
    .addTag('Tableau de bord', 'Module 2 — KPIs et synthèse du jour')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'VenteApp — Documentation API',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
