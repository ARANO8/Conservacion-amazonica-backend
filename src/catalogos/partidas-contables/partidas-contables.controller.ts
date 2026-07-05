import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PartidasContablesService } from './partidas-contables.service';

@ApiTags('catalogos')
@Controller('catalogos/partidas-contables')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PartidasContablesController {
  constructor(private readonly service: PartidasContablesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener catálogo de partidas contables' })
  async findAll() {
    return this.service.findAll();
  }
}
