import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './core/config/swagger.setup';
import { setupCors } from './core/config/cors.setup';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  setupCors(app);

  setupSwagger(app);

  const port = process.env.PORT ?? 3009;
  await app.listen(port);
  console.log(`API      : http://localhost:${port}/api`);
  console.log(`Swagger  : http://localhost:${port}/api/docs`);
}
bootstrap();
