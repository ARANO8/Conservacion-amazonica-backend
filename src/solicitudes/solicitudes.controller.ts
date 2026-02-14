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
  @UseGuards(JwtAuthGuard)
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
    const solicitud = await this.solicitudesService.findOne(id);
    const buffer = await this.reportsService.generateSolicitudPdf(
      solicitud as unknown as import('../reports/reports.service').SolicitudReportData,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Solicitud-${solicitud.codigoSolicitud}.pdf"`,
      'Content-Length': buffer.length.toString(),
    });

    return new StreamableFile(buffer);
  }
}
