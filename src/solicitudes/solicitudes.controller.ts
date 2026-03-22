import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseIntPipe,
  Res,
  Logger,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiProduces,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto';
import { AprobarSolicitudDto } from './dto/aprobar-solicitud.dto';
import { ObservarSolicitudDto } from './dto/observar-solicitud.dto';
import { DesembolsarSolicitudDto } from './dto/desembolsar-solicitud.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Request, Response } from 'express';
import { Rol } from '@prisma/client';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    email: string;
    rol: Rol;
  };
}

@ApiTags('Solicitudes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('solicitudes')
export class SolicitudesController {
  private readonly logger = new Logger(SolicitudesController.name);

  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva solicitud en estado PENDIENTE' })
  create(
    @Body() createSolicitudDto: CreateSolicitudDto,
    @Req() req: RequestWithUser,
  ) {
    this.logger.log(
      `[CREATE] usuarioId=${req.user.userId} | poaIds=${JSON.stringify(createSolicitudDto.poaIds)} | viaticos=${createSolicitudDto.viaticos?.length ?? 0} | gastos=${createSolicitudDto.gastos?.length ?? 0} | hospedajes=${createSolicitudDto.hospedajes?.length ?? 0} | planificaciones=${createSolicitudDto.planificaciones?.length ?? 0}`,
    );
    this.logger.debug(
      `[CREATE] Body completo: ${JSON.stringify(createSolicitudDto)}`,
    );
    return this.solicitudesService.create(createSolicitudDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar solicitudes (Filtrado por rol)' })
  @ApiQuery({
    name: 'partidaId',
    required: false,
    type: Number,
    description: 'Filtrar solicitudes por partida presupuestaria',
  })
  findAll(@Req() req: RequestWithUser, @Query('partidaId') partidaId?: string) {
    const partidaIdNumber =
      partidaId && partidaId.trim() !== '' ? Number(partidaId) : undefined;

    if (partidaId !== undefined && Number.isNaN(partidaIdNumber)) {
      throw new BadRequestException('El parámetro partidaId debe ser numérico');
    }

    return this.solicitudesService.findAll(
      {
        id: req.user.userId,
        rol: req.user.rol,
      },
      partidaIdNumber,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una solicitud' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.solicitudesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar una solicitud (Solo permitido si está OBSERVADO)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSolicitudDto: UpdateSolicitudDto,
    @Req() req: RequestWithUser,
  ) {
    return this.solicitudesService.update(
      id,
      updateSolicitudDto,
      req.user.userId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una solicitud (Soft Delete)' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.solicitudesService.remove(id, req.user.userId);
  }

  @Patch(':id/restore')
  @Roles(Rol.ADMIN, Rol.EJECUTIVO)
  @ApiOperation({ summary: 'Restaurar una solicitud eliminada' })
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.solicitudesService.restore(id);
  }

  @Patch(':id/aprobar')
  @ApiOperation({
    summary: 'Derivar solicitud (Mantiene PENDIENTE, cambia el aprobador)',
  })
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Body() aprobarDto: AprobarSolicitudDto,
  ) {
    return this.solicitudesService.aprobar(id, req.user.userId, aprobarDto);
  }

  @Patch(':id/observar')
  @ApiOperation({
    summary: 'Observar solicitud (Cambia de PENDIENTE a OBSERVADO)',
  })
  observar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Body() observarDto: ObservarSolicitudDto,
  ) {
    return this.solicitudesService.observar(id, req.user.userId, observarDto);
  }

  @Patch(':id/desembolsar')
  @Roles(Rol.TESORERO)
  @ApiOperation({
    summary: 'Desembolsar solicitud (Cambia de PENDIENTE a DESEMBOLSADO)',
  })
  desembolsar(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Body() desembolsarDto: DesembolsarSolicitudDto,
  ) {
    return this.solicitudesService.desembolsar(
      id,
      { id: req.user.userId, rol: req.user.rol },
      desembolsarDto,
    );
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generar y descargar reporte PDF de la solicitud' })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'Archivo PDF generado exitosamente.',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.solicitudesService.generatePdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="solicitud.pdf"',
    });
    res.send(buffer);
  }
}
