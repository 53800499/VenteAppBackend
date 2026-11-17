import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './core/config/swagger.setup';
import { setupCors } from './core/config/cors.setup';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupCors(app);
  app.setGlobalPrefix('api');

  // Swagger monté sur /api/docs et /docs
  setupSwagger(app);

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3009;
  await app.listen(port, '0.0.0.0');
  console.log(`API      : http://localhost:${port}/api`);
  console.log(`Swagger  : http://localhost:${port}/api/docs  (ou http://localhost:${port}/docs)`);
}
bootstrap();
