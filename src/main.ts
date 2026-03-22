import { NestFactory } from '@nestjs/core';
import { HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const DEFAULT_FRONTEND_URL = 'http://localhost:4200';
const DEFAULT_PORT = 3000;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendUrl = process.env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL;
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  // CORS: permitir solo el origen del frontend (configurable por variable de entorno)
  app.enableCors({
    origin: frontendUrl,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global Exception Filters (orden: el ÚLTIMO registrado se ejecuta PRIMERO)
  // 1. AllExceptionsFilter: fallback para TODO tipo de error
  // 2. PrismaClientExceptionFilter: maneja P2002/P2025 específicamente
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(
    new AllExceptionsFilter(),
    new PrismaClientExceptionFilter(httpAdapterHost),
  );

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('AMZdesk API - Conservación Amazónica')
    .setDescription('API para AMZdesk (POA, Solicitudes, Rendiciones)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, document);

  await app.listen(port);
}
void bootstrap();
