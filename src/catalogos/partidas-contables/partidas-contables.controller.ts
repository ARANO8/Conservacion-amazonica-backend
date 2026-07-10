import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PartidasContablesService } from './partidas-contables.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Catálogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catalogos/partidas-contables')
export class PartidasContablesController {
  constructor(private readonly service: PartidasContablesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener catálogo de partidas contables' })
  async findAll() {
    return this.service.findAll();
  }

  @Get('search')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Buscar partidas contables por código' })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Prefijo del código de partida contable',
  })
  search(@Query('q') q: string) {
    return this.service.search(q);
  }
}
