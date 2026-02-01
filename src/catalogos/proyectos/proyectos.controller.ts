import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProyectosService } from './proyectos.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Catálogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('proyectos')
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar proyectos' })
  findAll() {
    return this.proyectosService.findAll();
  }

  @Get('by-poa/:codigo')
  @ApiOperation({
    summary: 'Obtener proyectos únicos vinculados a un código POA',
  })
  findByPoaCode(@Param('codigo') codigo: string) {
    return this.proyectosService.findByPoaCode(codigo);
  }
}
