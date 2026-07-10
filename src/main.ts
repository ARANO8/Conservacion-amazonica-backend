import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const DEFAULT_FRONTEND_URL = 'http://localhost:4200';
const DEFAULT_PORT = 3000;

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendUrl = process.env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL;
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  // Headers de seguridad HTTP. CSP deshabilitado: la API no sirve HTML de la
  // aplicación y así no se rompe Swagger UI. CORP en cross-origin para que el
  // frontend (otro origen) pueda consumir recursos como los PDFs.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Parseo de cookies (necesario para leer el JWT desde la cookie httpOnly).
  app.use(cookieParser());

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

  // Swagger Configuration (diferido para no bloquear el arranque del servidor HTTP)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AMZdesk API - Conservación Amazónica')
    .setDescription('API para AMZdesk (POA, Solicitudes, Rendiciones)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  // createDocument hace introspección de todos los controladores/DTOs y puede ser lento
  // con 16+ módulos. Inicializamos el server HTTP primero.
  await app.listen(port);

  setImmediate(() => {
    try {
      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('doc', app, document);
      logger.log('Swagger documentación disponible en /doc');
    } catch (err) {
      logger.warn('Error al generar Swagger', err);
    }
  });
}
void bootstrap();
