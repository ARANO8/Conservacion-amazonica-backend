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
import { GruposService } from './grupos.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Catálogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('grupos')
export class GruposController {
  constructor(private readonly gruposService: GruposService) {}

  @Get()
  @ApiOperation({ summary: 'Listar grupos contables' })
  findAll() {
    return this.gruposService.findAll();
  }

  @Get('by-proyecto/:proyectoId')
  @ApiOperation({
    summary: 'Obtener grupos únicos que tienen presupuesto en un proyecto',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de grupos únicos con presupuesto asignado',
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
  findByProyectoId(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.gruposService.findByProyectoId(proyectoId);
  }
}
