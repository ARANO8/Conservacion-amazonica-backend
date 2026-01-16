import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { PoaService } from './poa.service';
import { CreatePoaDto } from './dto/create-poa.dto';
import { UpdatePoaDto } from './dto/update-poa.dto';
import { PoaPaginationDto } from './dto/poa-pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Rol } from '@prisma/client';

@ApiTags('POA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('poa')
export class PoaController {
  constructor(private readonly poaService: PoaService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener lista de POA con paginación y búsqueda' })
  findAll(@Query() paginationDto: PoaPaginationDto) {
    return this.poaService.findAll(paginationDto);
  }

  @Post()
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Crear una nueva fila de POA' })
  @ApiResponse({ status: 201, description: 'Fila creada exitosamente' })
  create(@Body() createPoaDto: CreatePoaDto) {
    return this.poaService.create(createPoaDto);
  }

  @Get('proyectos')
  @ApiOperation({ summary: 'Listar proyectos activos' })
  getProyectos() {
    return this.poaService.getProyectosActivos();
  }

  @Get('grupos/:proyectoId')
  @ApiOperation({ summary: 'Listar grupos de un proyecto' })
  getGrupos(@Param('proyectoId', ParseIntPipe) proyectoId: number) {
    return this.poaService.getGruposPorProyecto(proyectoId);
  }

  @Get('partidas/:proyectoId/:grupoId')
  @ApiOperation({ summary: 'Listar partidas con saldo calculado' })
  getPartidas(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('grupoId', ParseIntPipe) grupoId: number,
  ) {
    return this.poaService.getPartidasConSaldo(proyectoId, grupoId);
  }

  @Get('items/:proyectoId/:grupoId/:partidaId')
  @ApiOperation({
    summary:
      'Listar filas de POA disponibles (Actividades) para una partida específica',
  })
  getItems(
    @Param('proyectoId', ParseIntPipe) proyectoId: number,
    @Param('grupoId', ParseIntPipe) grupoId: number,
    @Param('partidaId', ParseIntPipe) partidaId: number,
  ) {
    return this.poaService.getItemsPorPartida(proyectoId, grupoId, partidaId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una fila de POA por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.poaService.findOne(id);
  }

  @Patch(':id')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Actualizar una fila de POA' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePoaDto: UpdatePoaDto,
  ) {
    return this.poaService.update(id, updatePoaDto);
  }

  @Delete(':id')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Eliminar una fila de POA (Borrado lógico)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.poaService.remove(id);
  }

  @Patch(':id/restore')
  @Roles(Rol.ADMIN)
  @ApiOperation({ summary: 'Restaurar un registro de POA eliminado' })
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.poaService.restore(id);
  }
}
