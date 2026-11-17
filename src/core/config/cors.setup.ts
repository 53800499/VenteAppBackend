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

  const configuredOrigins = allowAll
    ? []
    : raw
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origine (mobile apps, curl, backend-to-backend)
      if (!origin) return callback(null, true);
      if (allowAll) return callback(null, true);
      if (configuredOrigins.includes(origin)) return callback(null, true);
      // Autoriser localhost et 127.0.0.1 sur n'importe quel port en dev
      if (
        /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: [...ALLOWED_METHODS],
    allowedHeaders: [...ALLOWED_HEADERS, 'Access-Control-Allow-Headers', 'Access-Control-Allow-Origin'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86_400,
  });
}
