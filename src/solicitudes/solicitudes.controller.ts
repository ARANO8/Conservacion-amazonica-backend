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
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiProduces,
  ApiOkResponse,
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
import { ReportsService } from '../reports/reports.service';
import type { SolicitudReportData } from '../reports/reports.service';
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
  constructor(
    private readonly solicitudesService: SolicitudesService,
    private readonly reportsService: ReportsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva solicitud en estado PENDIENTE' })
  create(
    @Body() createSolicitudDto: CreateSolicitudDto,
    @Req() req: RequestWithUser,
  ) {
    return this.solicitudesService.create(createSolicitudDto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar solicitudes (Filtrado por rol)' })
  findAll(@Req() req: RequestWithUser) {
    return this.solicitudesService.findAll({
      id: req.user.userId,
      rol: req.user.rol,
    });
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
  @Roles(Rol.ADMIN)
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    try {
      console.log(`[PDF] Iniciando generación de PDF para solicitud ID: ${id}`);

      const solicitud = await this.solicitudesService.findOne(id);
      console.log(`[PDF] Solicitud obtenida:`, {
        codigoSolicitud: solicitud.codigoSolicitud,
        hasEmisor: !!solicitud.usuarioEmisor,
        hasAprobador: !!solicitud.aprobador,
        hasBeneficiado: !!solicitud.usuarioBeneficiado,
        viaticosCount: solicitud.viaticos?.length || 0,
        gastosCount: solicitud.gastos?.length || 0,
      });

      // Mapear datos de Solicitud a SolicitudReportData
      const reportData = this.mapSolicitudToReportData(solicitud);
      console.log(`[PDF] Datos mapeados correctamente`);

      const buffer = await this.reportsService.generateSolicitudPdf(reportData);
      console.log(
        `[PDF] PDF generado exitosamente, tamaño: ${buffer.length} bytes`,
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Solicitud-${solicitud.codigoSolicitud}.pdf"`,
        'Content-Length': buffer.length.toString(),
      });

      return new StreamableFile(buffer);
    } catch (error) {
      console.error('[PDF] Error generando PDF:', error);
      if (error instanceof Error) {
        console.error('[PDF] Stack trace:', error.stack);
      }
      throw error;
    }
  }

  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
  private mapSolicitudToReportData(solicitud: any): SolicitudReportData {
    console.log('[PDF Mapping] Iniciando mapeo de datos de solicitud');

    // Mapear viaticos con validación
    const viaticos = (solicitud.viaticos || []).map((v: any, idx: number) => {
      const mapped = {
        tipoDestino: v.tipoDestino || '',
        dias: v.dias || 0,
        cantidadPersonas: v.cantidadPersonas || 0,
        costoUnitario: v.costoUnitario,
        montoPresupuestado: v.montoPresupuestado,
        montoNeto: v.montoNeto,
        concepto: v.concepto ? { nombre: v.concepto.nombre } : undefined,
      };
      console.log(`[PDF Mapping] Viatico ${idx}:`, mapped);
      return mapped;
    });

    // Mapear gastos con validación
    const gastos = (solicitud.gastos || []).map((g: any, idx: number) => {
      const mapped = {
        detalle: g.detalle,
        tipoDocumento: g.tipoDocumento || '',
        cantidad: g.cantidad || 0,
        costoUnitario: g.costoUnitario,
        montoPresupuestado: g.montoPresupuestado,
        montoNeto: g.montoNeto,
        tipoGasto: g.tipoGasto ? { nombre: g.tipoGasto.nombre } : undefined,
      };
      console.log(`[PDF Mapping] Gasto ${idx}:`, mapped);
      return mapped;
    });

    // Extraer cuenta bancaria del primer proyecto de los presupuestos
    // (asume que todos los presupuestos tienen el mismo proyecto/cuenta)
    let cuentaBancaria: any = undefined;
    const presupuestos = solicitud.presupuestos || [];
    if (presupuestos.length > 0) {
      const firstPresupuesto = presupuestos[0];
      if (firstPresupuesto?.poa?.estructura?.proyecto?.cuentaBancaria) {
        cuentaBancaria = {
          numeroCuenta:
            firstPresupuesto.poa.estructura.proyecto.cuentaBancaria
              .numeroCuenta,
          banco: firstPresupuesto.poa.estructura.proyecto.cuentaBancaria.banco,
          moneda:
            firstPresupuesto.poa.estructura.proyecto.cuentaBancaria.moneda,
        };
        console.log('[PDF Mapping] Cuenta bancaria extraída:', cuentaBancaria);
      }
    }

    const result: SolicitudReportData = {
      codigoSolicitud: solicitud.codigoSolicitud || '',
      lugarViaje: solicitud.lugarViaje,
      motivoViaje: solicitud.motivoViaje,
      fechaInicio: solicitud.fechaInicio,
      fechaFin: solicitud.fechaFin,
      montoTotalPresupuestado: solicitud.montoTotalPresupuestado,
      montoTotalNeto: solicitud.montoTotalNeto,
      usuarioEmisor: solicitud.usuarioEmisor
        ? {
            nombreCompleto: solicitud.usuarioEmisor.nombreCompleto,
            cargo: solicitud.usuarioEmisor.cargo,
          }
        : undefined,
      aprobador: solicitud.aprobador
        ? {
            nombreCompleto: solicitud.aprobador.nombreCompleto,
          }
        : undefined,
      usuarioBeneficiado: solicitud.usuarioBeneficiado
        ? {
            nombreCompleto: solicitud.usuarioBeneficiado.nombreCompleto,
          }
        : undefined,
      presupuestos: presupuestos.map((p: any) => ({
        poa: p.poa
          ? {
              codigoPoa: p.poa.codigoPoa,
              actividad: p.poa.actividad,
              estructura: p.poa.estructura,
              codigoPresupuestario: p.poa.codigoPresupuestario,
            }
          : undefined,
      })),
      planificaciones: (solicitud.planificaciones || []).map((plan: any) => ({
        fechaInicio: plan.fechaInicio,
        fechaFin: plan.fechaFin,
        actividadProgramada: plan.actividadProgramada,
        cantidadPersonasInstitucional: plan.cantidadPersonasInstitucional,
        cantidadPersonasTerceros: plan.cantidadPersonasTerceros,
      })),
      viaticos,
      gastos,
      cuentaBancaria,
    };

    console.log('[PDF Mapping] Mapeo completado exitosamente');
    return result;
  }
}
