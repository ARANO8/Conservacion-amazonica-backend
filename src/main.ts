import { NestFactory } from '@nestjs/core';
import { HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: permitir solo el origen del frontend (configurable por variable de entorno)
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:4200',
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

  // Global Prisma Exception Filter
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapterHost));

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('SIFIN API - Conservación Amazónica')
    .setDescription(
      'API para el Sistema Financiero Integrado (POA, Solicitudes, Rendiciones)',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
