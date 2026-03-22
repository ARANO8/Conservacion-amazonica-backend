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
import { PdfService } from '../pdf/pdf.service';

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

  constructor(
    private readonly solicitudesService: SolicitudesService,
    private readonly pdfService: PdfService,
  ) {}

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
    const solicitud = await this.solicitudesService.findOne(id);

    const detalle = [
      ...(solicitud.viaticos ?? []).map((viatico) => ({
        categoria: 'Viático',
        descripcion: viatico.concepto?.nombre ?? viatico.tipoDestino,
        cantidad: `${Number(viatico.dias ?? 0)} días x ${viatico.cantidadPersonas} pers`,
        montoNeto: this.formatCurrency(Number(viatico.montoNeto ?? 0)),
      })),
      ...(solicitud.gastos ?? []).map((gasto) => ({
        categoria: 'Gasto',
        descripcion: gasto.tipoGasto?.nombre ?? gasto.detalle ?? 'Sin detalle',
        cantidad: `${gasto.cantidad}`,
        montoNeto: this.formatCurrency(Number(gasto.montoNeto ?? 0)),
      })),
      ...(solicitud.hospedajes ?? []).map((hospedaje) => ({
        categoria: 'Hospedaje',
        descripcion: hospedaje.destino,
        cantidad: `${hospedaje.noches} noches`,
        montoNeto: this.formatCurrency(Number(hospedaje.costoTotal ?? 0)),
      })),
    ];

    const buffer = await this.pdfService.generatePdf('solicitud.hbs', {
      ...solicitud,
      codigoSolicitud: solicitud.codigoSolicitud,
      fechaSolicitud: this.formatDate(solicitud.fechaSolicitud),
      fechaInicio: this.formatDate(solicitud.fechaInicio),
      fechaFin: this.formatDate(solicitud.fechaFin),
      montoTotalNeto: this.formatCurrency(
        Number(solicitud.montoTotalNeto ?? 0),
      ),
      montoTotalPresupuestado: this.formatCurrency(
        Number(solicitud.montoTotalPresupuestado ?? 0),
      ),
      emisorNombre: solicitud.usuarioEmisor?.nombreCompleto ?? 'N/A',
      emisorCargo: solicitud.usuarioEmisor?.cargo ?? 'N/A',
      aprobadorNombre: solicitud.aprobador?.nombreCompleto ?? 'Sin asignar',
      motivoViaje: solicitud.motivoViaje ?? 'Sin motivo registrado',
      lugarViaje: solicitud.lugarViaje ?? 'Sin lugar registrado',
      detalle,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="solicitud.pdf"',
    });
    res.send(buffer);
  }

  private formatDate(value: Date | string | null | undefined): string {
    if (!value) return 'N/A';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  private formatCurrency(value: number): string {
    return `Bs ${new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`;
  }
}
