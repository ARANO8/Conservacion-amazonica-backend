import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { PartidasService } from './partidas.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Catálogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('partidas')
export class PartidasController {
  constructor(private readonly partidasService: PartidasService) {}

  @Get()
  @ApiOperation({ summary: 'Listar partidas presupuestarias' })
  findAll() {
    return this.partidasService.findAll();
  }

  @Get('by-grupo/:grupoId')
  @ApiOperation({ summary: 'Listar partidas por grupo (Cascada)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de partidas asociadas al grupo',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          nombre: { type: 'string' },
        },
      },
    },
  })
  findByGrupoId(@Param('grupoId', ParseIntPipe) grupoId: number) {
    return this.partidasService.findByGrupoId(grupoId);
  }
}
