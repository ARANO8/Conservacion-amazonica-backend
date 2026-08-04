import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Endpoint público de salud. Lo consultan el healthcheck de Docker, el smoke
 * test posterior al despliegue y el indicador de conexión del frontend, así que
 * queda fuera del rate limiting: un 429 aquí se leería como caída del servicio.
 */
@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Estado del servicio y de su conexión con la base de datos',
  })
  @ApiResponse({
    status: 200,
    description: 'El servicio responde y la base de datos está accesible',
  })
  @ApiResponse({ status: 503, description: 'La base de datos no responde' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(
        'Healthcheck fallido: la base de datos no responde',
        error,
      );
      throw new ServiceUnavailableException('Base de datos no disponible');
    }

    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
    };
  }
}
