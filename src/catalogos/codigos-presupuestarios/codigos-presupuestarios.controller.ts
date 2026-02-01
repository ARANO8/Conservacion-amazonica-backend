import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { CodigosPresupuestariosService } from './codigos-presupuestarios.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Catálogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('codigos-presupuestarios')
export class CodigosPresupuestariosController {
  constructor(
    private readonly codigosPresupuestariosService: CodigosPresupuestariosService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar códigos presupuestarios' })
  findAll() {
    return this.codigosPresupuestariosService.findAll();
  }

  @Get('filter')
  @ApiOperation({
    summary: 'Filtrar código presupuestario por estructura (4 niveles)',
  })
  @ApiQuery({ name: 'codigoPoa', type: String, required: true })
  @ApiQuery({ name: 'proyectoId', type: Number, required: true })
  @ApiQuery({ name: 'grupoId', type: Number, required: true })
  @ApiQuery({ name: 'partidaId', type: Number, required: true })
  @ApiResponse({
    status: 200,
    description: 'Código presupuestario encontrado',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          codigoCompleto: { type: 'string' },
        },
      },
    },
  })
  filterByStructure(
    @Query('codigoPoa') codigoPoa: string,
    @Query('proyectoId', ParseIntPipe) proyectoId: number,
    @Query('grupoId', ParseIntPipe) grupoId: number,
    @Query('partidaId', ParseIntPipe) partidaId: number,
  ) {
    return this.codigosPresupuestariosService.filterByStructure(
      codigoPoa,
      proyectoId,
      grupoId,
      partidaId,
    );
  }
}
