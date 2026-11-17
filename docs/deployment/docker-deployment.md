# Déploiement Conteneurisé avec Docker

Ce document décrit le déploiement de production du backend NestJS sous Docker.

---

## 1. Build de l'Image Docker de Production

```bash
# Se placer dans le répertoire backend
cd backend

# Construire l'image Docker
docker build -t arike-backend:1.0.1 -f Dockerfile .
```

---

## 2. Lancement avec Docker Compose

Fichier `docker-compose.prod.yml` :
```yaml
version: '3.8'

services:
  api:
    image: arike-backend:1.0.1
    container_name: arike_api_prod
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
    env_file:
      - .env
    volumes:
      - /var/www/arike-releases:/var/www/arike-releases:rw
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Démarrage :
```bash
docker compose -f docker-compose.prod.yml up -d
```

