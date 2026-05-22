import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { Rol, Prisma } from '@prisma/client';
import { PdfService } from '../pdf/pdf.service';
import { COTIZACION_INCLUDE } from './cotizaciones.constants';
import { montoEnLetrasBolivianos } from './cotizaciones.helper';

type UsuarioContexto = { id: number; rol: Rol };

const ROLES_VISTA_GLOBAL: Rol[] = [Rol.ADMIN, Rol.EJECUTIVO];

// Filas mínimas que muestra la tabla del PDF, para replicar el formato
// impreso oficial (rellena con filas en blanco cuando hay menos ítems).
const FILAS_TABLA_PDF = 9;

@Injectable()
export class CotizacionesService {
  private readonly logger = new Logger(CotizacionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  private async generarCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const anioActual = new Date().getFullYear();
    const count = await tx.cotizacion.count({
      where: {
        fecha: {
          gte: new Date(`${anioActual}-01-01`),
          lte: new Date(`${anioActual}-12-31`),
        },
      },
    });

    const correlativo = (count + 1).toString().padStart(3, '0');
    return `COT-${anioActual}-${correlativo}`;
  }

  private construirLineas(dto: CreateCotizacionDto) {
    const lineas = dto.lineas.map((linea) => {
      const cantidad = new Prisma.Decimal(linea.cantidad);
      const precioUnitario = new Prisma.Decimal(linea.precioUnitario);
      const total = cantidad.times(precioUnitario);

      return {
        cantidad,
        unidad: linea.unidad?.trim() || null,
        detalle: linea.detalle.trim(),
        precioUnitario,
        total,
      };
    });

    const total = lineas.reduce(
      (acc, linea) => acc.plus(linea.total),
      new Prisma.Decimal(0),
    );

    return { lineas, total };
  }

  async create(dto: CreateCotizacionDto, usuarioId: number) {
    return this.prisma.$transaction(async (tx) => {
      const codigoCotizacion = await this.generarCodigo(tx);
      const { lineas, total } = this.construirLineas(dto);

      this.logger.log(
        `[create] usuarioId=${usuarioId} | codigo=${codigoCotizacion} | lineas=${lineas.length}`,
      );

      return tx.cotizacion.create({
        data: {
          codigoCotizacion,
          fecha: dto.fecha ? new Date(dto.fecha) : new Date(),
          proveedorNombre: dto.proveedorNombre.trim(),
          proveedorTelefono: dto.proveedorTelefono?.trim() || null,
          proveedorDireccion: dto.proveedorDireccion?.trim() || null,
          proveedorCorreo: dto.proveedorCorreo?.trim() || null,
          garantia: dto.garantia?.trim() || null,
          disponibilidad: dto.disponibilidad?.trim() || null,
          duracionCotizacion: dto.duracionCotizacion?.trim() || null,
          emiteFactura: dto.emiteFactura ?? false,
          observaciones: dto.observaciones?.trim() || null,
          tipo: dto.tipo ?? 'PROPIA',
          adjuntoUrl: dto.adjuntoUrl?.trim() || null,
          total,
          usuarioEmisorId: usuarioId,
          lineas: { create: lineas },
        },
        include: COTIZACION_INCLUDE,
      });
    });
  }

  async findAll(user: UsuarioContexto) {
    const esVistaGlobal = ROLES_VISTA_GLOBAL.includes(user.rol);

    return this.prisma.cotizacion.findMany({
      where: {
        deletedAt: null,
        ...(esVistaGlobal ? {} : { usuarioEmisorId: user.id }),
      },
      include: COTIZACION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const cotizacion = await this.prisma.cotizacion.findFirst({
      where: { id, deletedAt: null },
      include: COTIZACION_INCLUDE,
    });

    if (!cotizacion) {
      throw new NotFoundException(`Cotización ${id} no encontrada`);
    }

    return cotizacion;
  }

  private asegurarPropietario(emisorId: number, user: UsuarioContexto): void {
    const esVistaGlobal = ROLES_VISTA_GLOBAL.includes(user.rol);
    if (!esVistaGlobal && emisorId !== user.id) {
      throw new ForbiddenException(
        'No tienes permiso para modificar esta cotización',
      );
    }
  }

  async update(id: number, dto: UpdateCotizacionDto, user: UsuarioContexto) {
    const cotizacion = await this.findOne(id);
    this.asegurarPropietario(cotizacion.usuarioEmisorId, user);

    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.CotizacionUpdateInput = {
        ...(dto.fecha !== undefined ? { fecha: new Date(dto.fecha) } : {}),
        ...(dto.proveedorNombre !== undefined
          ? { proveedorNombre: dto.proveedorNombre.trim() }
          : {}),
        ...(dto.proveedorTelefono !== undefined
          ? { proveedorTelefono: dto.proveedorTelefono?.trim() || null }
          : {}),
        ...(dto.proveedorDireccion !== undefined
          ? { proveedorDireccion: dto.proveedorDireccion?.trim() || null }
          : {}),
        ...(dto.proveedorCorreo !== undefined
          ? { proveedorCorreo: dto.proveedorCorreo?.trim() || null }
          : {}),
        ...(dto.garantia !== undefined
          ? { garantia: dto.garantia?.trim() || null }
          : {}),
        ...(dto.disponibilidad !== undefined
          ? { disponibilidad: dto.disponibilidad?.trim() || null }
          : {}),
        ...(dto.duracionCotizacion !== undefined
          ? { duracionCotizacion: dto.duracionCotizacion?.trim() || null }
          : {}),
        ...(dto.emiteFactura !== undefined
          ? { emiteFactura: dto.emiteFactura }
          : {}),
        ...(dto.observaciones !== undefined
          ? { observaciones: dto.observaciones?.trim() || null }
          : {}),
      };

      if (dto.lineas !== undefined) {
        const { lineas, total } = this.construirLineas(
          dto as CreateCotizacionDto,
        );
        data.total = total;
        await tx.lineaCotizacion.deleteMany({ where: { cotizacionId: id } });
        data.lineas = { create: lineas };
      }

      return tx.cotizacion.update({
        where: { id },
        data,
        include: COTIZACION_INCLUDE,
      });
    });
  }

  async remove(id: number, user: UsuarioContexto) {
    const cotizacion = await this.findOne(id);
    this.asegurarPropietario(cotizacion.usuarioEmisorId, user);

    await this.prisma.cotizacion.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Cotización eliminada correctamente' };
  }

  async generatePdf(id: number): Promise<Buffer> {
    const cotizacion = await this.findOne(id);
    const totalNumero = Number(cotizacion.total ?? 0);

    const lineas = cotizacion.lineas.map((linea) => ({
      cantidad: this.formatCantidad(Number(linea.cantidad ?? 0)),
      unidad: linea.unidad ?? '',
      detalle: linea.detalle,
      precioUnitario: this.formatNumber(Number(linea.precioUnitario ?? 0)),
      total: this.formatNumber(Number(linea.total ?? 0)),
    }));

    const filasMinimas = Math.max(0, FILAS_TABLA_PDF - lineas.length);
    const filasVacias = Array.from({ length: filasMinimas }, () => ({}));

    return this.pdfService.generatePdf('cotizacion.hbs', {
      codigoCotizacion: cotizacion.codigoCotizacion,
      fecha: this.formatDate(cotizacion.fecha),
      proveedorNombre: cotizacion.proveedorNombre,
      proveedorTelefono: cotizacion.proveedorTelefono ?? '',
      proveedorDireccion: cotizacion.proveedorDireccion ?? '',
      proveedorCorreo: cotizacion.proveedorCorreo ?? '',
      garantia: cotizacion.garantia ?? '',
      disponibilidad: cotizacion.disponibilidad ?? '',
      duracionCotizacion: cotizacion.duracionCotizacion ?? '',
      emiteFactura: cotizacion.emiteFactura ? 'SI' : 'NO',
      observaciones: cotizacion.observaciones ?? '',
      total: this.formatNumber(totalNumero),
      totalEnLetras: montoEnLetrasBolivianos(totalNumero),
      lineas,
      filasVacias,
    });
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

  private formatCantidad(value: number): string {
    return new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
