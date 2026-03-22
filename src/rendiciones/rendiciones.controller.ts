import {
  BadRequestException,
  ForbiddenException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Rol } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateRendicionDto } from './dto/create-rendicion.dto';
import { AprobarRendicionDto } from './dto/aprobar-rendicion.dto';
import { ObservarRendicionDto } from './dto/observar-rendicion.dto';
import { RendicionesService } from './rendiciones.service';
import { PdfService } from '../pdf/pdf.service';
import { existsSync } from 'fs';
import * as path from 'path';

interface RequestWithUser extends Request {
  user?: {
    userId: number;
    email: string;
    rol: Rol;
  };
}

const RENDICIONES_ALLOWED_ROLES: Rol[] = [
  Rol.ADMIN,
  Rol.EJECUTIVO,
  Rol.CONTADOR,
  Rol.TESORERO,
  Rol.USUARIO,
];

@ApiTags('Rendiciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...RENDICIONES_ALLOWED_ROLES)
@Controller('rendiciones')
export class RendicionesController {
  constructor(
    private readonly rendicionesService: RendicionesService,
    private readonly pdfService: PdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar rendiciones (filtrado por rol de usuario)' })
  @ApiResponse({
    status: 200,
    description: 'Listado de rendiciones obtenido correctamente',
  })
  findAll(
    @Req() req: RequestWithUser,
    @Query('solicitudId') solicitudId?: string,
  ) {
    const solicitudIdNumber =
      solicitudId && solicitudId.trim() !== ''
        ? Number(solicitudId)
        : undefined;

    if (solicitudId !== undefined && Number.isNaN(solicitudIdNumber)) {
      throw new BadRequestException(
        'El parámetro solicitudId debe ser numérico',
      );
    }

    return this.rendicionesService.findAll(
      {
        id: req.user!.userId,
        rol: req.user!.rol,
      },
      solicitudIdNumber,
    );
  }

  @Get('solicitud/:solicitudId')
  @ApiOperation({ summary: 'Obtener la rendición por ID de solicitud' })
  @ApiResponse({
    status: 200,
    description: 'Rendición encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontró rendición para la solicitud indicada',
  })
  findBySolicitudId(@Param('solicitudId', ParseIntPipe) solicitudId: number) {
    return this.rendicionesService.findBySolicitudId(solicitudId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una rendición por ID' })
  @ApiResponse({
    status: 200,
    description: 'Rendición encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontró la rendición indicada',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rendicionesService.findOne(id);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generar y visualizar PDF de una rendición' })
  @ApiProduces('application/pdf')
  @ApiOkResponse({
    description: 'PDF de rendición generado correctamente',
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
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ): Promise<void> {
    const rendicion = await this.rendicionesService.findOne(id);

    if (
      req.user!.rol === Rol.USUARIO &&
      rendicion.solicitud.usuarioEmisorId !== req.user!.userId
    ) {
      throw new ForbiddenException(
        'No tienes permisos para visualizar esta rendición',
      );
    }

    const totalEfectivoPagado = Number(
      (rendicion.gastosRendicion ?? [])
        .reduce((acc, gasto) => acc + Number(gasto.montoNeto ?? 0), 0)
        .toFixed(2),
    );

    const montoRecibido = Number(rendicion.solicitud.montoTotalNeto ?? 0);
    const saldoLiquido = Number(
      (montoRecibido - totalEfectivoPagado).toFixed(2),
    );

    const buffer = await this.pdfService.generatePdf('rendicion.hbs', {
      ...rendicion,
      usuario: {
        nombre: rendicion.solicitud.usuarioEmisor?.nombreCompleto ?? 'N/A',
        cargo: rendicion.solicitud.usuarioEmisor?.cargo ?? 'N/A',
      },
      solicitud: {
        ...rendicion.solicitud,
        montoTotalNeto: this.formatCurrency(montoRecibido),
      },
      aprobadorActualNombre:
        rendicion.aprobadorActual?.nombreCompleto ?? 'Sin asignar',
      fechaRendicion: this.formatDate(rendicion.fechaRendicion),
      totalEfectivoPagado,
      saldoLiquido,
      totalEfectivoPagadoFormat: this.formatCurrency(totalEfectivoPagado),
      saldoLiquidoFormat: this.formatCurrency(saldoLiquido),
      gastos: (rendicion.gastosRendicion ?? []).map((gasto) => ({
        ...gasto,
        fecha: this.formatDate(gasto.fecha),
        proveedor: gasto.proveedor ?? 'N/A',
        concepto: gasto.concepto ?? gasto.detalle ?? 'N/A',
        montoBruto: this.formatCurrency(Number(gasto.montoBruto ?? 0)),
        montoImpuestos: this.formatCurrency(Number(gasto.montoImpuestos ?? 0)),
        montoNeto: this.formatCurrency(Number(gasto.montoNeto ?? 0)),
      })),
      informeGastos: this.buildInformeTexto(rendicion.informeGastos),
      logoUrl: this.getLogoUrl(),
      generatedAt: this.formatDate(new Date()),
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="rendicion.pdf"',
    });
    res.send(buffer);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una rendición con detalle completo' })
  @ApiResponse({
    status: 201,
    description: 'Rendición creada exitosamente',
  })
  create(
    @Body() createRendicionDto: CreateRendicionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.rendicionesService.create(createRendicionDto, req.user!.userId);
  }

  @Post(':id/aprobar')
  @ApiOperation({ summary: 'Aprobar o derivar una rendición' })
  @ApiResponse({
    status: 200,
    description: 'Rendición aprobada o derivada correctamente',
  })
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Body() aprobarRendicionDto: AprobarRendicionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.rendicionesService.aprobar(
      id,
      aprobarRendicionDto,
      req.user!.userId,
      req.user!.rol,
    );
  }

  @Post(':id/observar')
  @ApiOperation({ summary: 'Observar una rendición y devolver al creador' })
  @ApiResponse({
    status: 200,
    description: 'Rendición observada correctamente',
  })
  observar(
    @Param('id', ParseIntPipe) id: number,
    @Body() observarRendicionDto: ObservarRendicionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.rendicionesService.observar(
      id,
      observarRendicionDto,
      req.user!.userId,
      req.user!.rol,
    );
  }

  private formatCurrency(value: number): string {
    return `Bs ${new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`;
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

  private buildInformeTexto(
    informe:
      | {
          fechaInicio: Date;
          fechaFin: Date;
          actividades?: {
            fecha: Date;
            lugar: string;
            personaInstitucion: string;
            actividadesRealizadas: string;
          }[];
        }
      | null
      | undefined,
  ): string {
    if (!informe) {
      return 'Sin informe registrado.';
    }

    const encabezado = `Periodo: ${this.formatDate(informe.fechaInicio)} - ${this.formatDate(informe.fechaFin)}`;
    const actividades = (informe.actividades ?? []).map(
      (actividad, index) =>
        `Actividad ${index + 1}:\nFecha: ${this.formatDate(actividad.fecha)}\nLugar: ${actividad.lugar}\nPersona / Institución: ${actividad.personaInstitucion}\nDetalle: ${actividad.actividadesRealizadas}`,
    );

    return [encabezado, ...actividades].join('\n\n');
  }

  private getLogoUrl(): string | null {
    const logoPath = path.join(process.cwd(), 'logo.png');
    if (!existsSync(logoPath)) {
      return null;
    }

    const normalizedPath = logoPath.replace(/\\/g, '/');
    return `file:///${normalizedPath}`;
  }
}
