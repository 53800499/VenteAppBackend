import { INestApplication } from '@nestjs/common';

const ALLOWED_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'] as const;

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'X-Shop-Id',
  'X-Requested-With',
  'Origin',
];

/**
 * CORS — clients web, Swagger, tests depuis émulateur / appareils physiques.
 * `CORS_ORIGINS=*` (défaut) : toute origine (origin reflect).
 * Sinon : liste séparée par des virgules (ex. https://app.example.com,http://localhost:5173).
 */
export function setupCors(app: INestApplication): void {
  const raw = (process.env.CORS_ORIGINS ?? '*').trim();
  const allowAll = raw === '*' || raw.toLowerCase() === 'true';

  const origins = allowAll
    ? true
    : raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: !allowAll,
    methods: [...ALLOWED_METHODS],
    allowedHeaders: ALLOWED_HEADERS,
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86_400,
  });
}
