import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Rol } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { CreateDeclaracionMovilidadDto } from './dto/create-declaracion-movilidad.dto';
import { UpdateDeclaracionMovilidadDto } from './dto/update-declaracion-movilidad.dto';
import {
  calcularMonto,
  resumirDeclaracion,
} from './declaraciones-movilidad.helper';
import { formatDate } from '../shared/utils/formatters.util';
import { LOCALE_DEFAULT } from '../common/constants/financial.constants';

/** ADMIN y EJECUTIVO ven las declaraciones de todos; el resto sólo las suyas. */
const ROLES_VISTA_GLOBAL: Rol[] = [Rol.ADMIN, Rol.EJECUTIVO];

const DECLARACION_INCLUDE = {
  usuario: {
    select: { id: true, nombreCompleto: true, email: true, cargo: true },
  },
  detalles: {
    orderBy: { orden: 'asc' as const },
  },
} satisfies Prisma.DeclaracionMovilidadInclude;

interface UsuarioContexto {
  id: number;
  rol: Rol;
}

/**
 * Filas tal como las manda el formulario, ya con el monto con impuestos.
 * Se tipa aquí en vez de reusar el input de Prisma porque ese admite
 * `DecimalJsLike` y perderíamos el `Decimal` que necesitan los totales.
 */
interface FilaCalculada {
  orden: number;
  fecha: Date;
  origen: string;
  destino: string;
  motivo: string;
  montoGastado: Prisma.Decimal;
  monto: Prisma.Decimal;
}

@Injectable()
export class DeclaracionesMovilidadService {
  private readonly logger = new Logger(DeclaracionesMovilidadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  private async generarCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const anioActual = new Date().getFullYear();
    const count = await tx.declaracionMovilidad.count({
      where: {
        createdAt: {
          gte: new Date(`${anioActual}-01-01`),
          lte: new Date(`${anioActual}-12-31`),
        },
      },
    });
    const correlativo = (count + 1).toString().padStart(3, '0');
    return `DJM-${anioActual}-${correlativo}`;
  }

  private esVistaGlobal(rol: Rol): boolean {
    return ROLES_VISTA_GLOBAL.includes(rol);
  }

  /**
   * El gasto declarado es lo único que viaja desde el formulario; el monto con
   * impuestos y los totales se recalculan siempre en el servidor.
   */
  private prepararFilas(
    detalles: CreateDeclaracionMovilidadDto['detalles'],
  ): FilaCalculada[] {
    return detalles.map((detalle, indice) => ({
      orden: indice,
      fecha: detalle.fecha,
      origen: detalle.origen.trim(),
      destino: detalle.destino.trim(),
      motivo: detalle.motivo.trim(),
      montoGastado: new Prisma.Decimal(detalle.montoGastado),
      monto: calcularMonto(detalle.montoGastado),
    }));
  }

  async create(dto: CreateDeclaracionMovilidadDto, usuarioId: number) {
    const autor = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, deletedAt: null },
      select: { cargo: true },
    });

    if (!autor) {
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);
    }

    const filas = this.prepararFilas(dto.detalles);
    const resumen = resumirDeclaracion(filas.map((fila) => fila.monto));

    return this.prisma.$transaction(async (tx) => {
      const codigoDeclaracion = await this.generarCodigo(tx);

      const declaracion = await tx.declaracionMovilidad.create({
        data: {
          codigoDeclaracion,
          cargo: dto.cargo?.trim() || autor.cargo || 'Sin cargo registrado',
          motivoActividad: dto.motivoActividad.trim(),
          proyectoPartida: dto.proyectoPartida.trim(),
          lugarEmision: dto.lugarEmision?.trim() || 'La Paz',
          fechaEmision: dto.fechaEmision,
          totalBruto: resumen.totalBruto,
          retencion: resumen.retencion,
          totalLiquido: resumen.totalLiquido,
          usuarioId,
          detalles: { create: filas },
        },
        include: DECLARACION_INCLUDE,
      });

      this.logger.log(
        `[create] usuarioId=${usuarioId} | codigo=${codigoDeclaracion} | tramos=${filas.length}`,
      );

      return declaracion;
    });
  }

  async findAll(user: UsuarioContexto) {
    const where: Prisma.DeclaracionMovilidadWhereInput = this.esVistaGlobal(
      user.rol,
    )
      ? { deletedAt: null }
      : { deletedAt: null, usuarioId: user.id };

    return this.prisma.declaracionMovilidad.findMany({
      where,
      include: DECLARACION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user?: UsuarioContexto) {
    const declaracion = await this.prisma.declaracionMovilidad.findFirst({
      where: { id, deletedAt: null },
      include: DECLARACION_INCLUDE,
    });

    if (!declaracion) {
      throw new NotFoundException(
        `Declaración de movilidad ${id} no encontrada`,
      );
    }

    if (
      user &&
      !this.esVistaGlobal(user.rol) &&
      declaracion.usuarioId !== user.id
    ) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a esta declaración de movilidad',
      );
    }

    return declaracion;
  }

  /** Sólo el autor puede modificar o eliminar su declaración. */
  private async findPropia(id: number, usuarioId: number) {
    const declaracion = await this.prisma.declaracionMovilidad.findFirst({
      where: { id, deletedAt: null },
    });

    if (!declaracion) {
      throw new NotFoundException(
        `Declaración de movilidad ${id} no encontrada`,
      );
    }

    if (declaracion.usuarioId !== usuarioId) {
      throw new ForbiddenException(
        'Sólo el autor puede modificar esta declaración de movilidad',
      );
    }

    return declaracion;
  }

  async update(
    id: number,
    dto: UpdateDeclaracionMovilidadDto,
    usuarioId: number,
  ) {
    const actual = await this.findPropia(id, usuarioId);

    const filas = dto.detalles ? this.prepararFilas(dto.detalles) : null;
    const resumen = filas
      ? resumirDeclaracion(filas.map((fila) => fila.monto))
      : null;

    return this.prisma.$transaction(async (tx) => {
      // El detalle se reemplaza entero: el formulario manda la lista completa
      if (filas) {
        await tx.detalleMovilidad.deleteMany({ where: { declaracionId: id } });
      }

      return tx.declaracionMovilidad.update({
        where: { id },
        data: {
          cargo: dto.cargo?.trim() ?? actual.cargo,
          motivoActividad:
            dto.motivoActividad?.trim() ?? actual.motivoActividad,
          proyectoPartida:
            dto.proyectoPartida?.trim() ?? actual.proyectoPartida,
          lugarEmision: dto.lugarEmision?.trim() ?? actual.lugarEmision,
          fechaEmision: dto.fechaEmision ?? actual.fechaEmision,
          ...(filas && resumen
            ? {
                totalBruto: resumen.totalBruto,
                retencion: resumen.retencion,
                totalLiquido: resumen.totalLiquido,
                detalles: { create: filas },
              }
            : {}),
        },
        include: DECLARACION_INCLUDE,
      });
    });
  }

  async remove(id: number, usuarioId: number) {
    await this.findPropia(id, usuarioId);

    await this.prisma.declaracionMovilidad.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`[remove] declaracionId=${id} | usuarioId=${usuarioId}`);

    return { mensaje: 'Declaración de movilidad eliminada correctamente' };
  }

  /**
   * ANEXO 6 impreso. La columna auxiliar del gasto declarado no se incluye:
   * el documento oficial sólo muestra el monto con impuestos.
   */
  /**
   * Las fechas del anexo son fechas de calendario, no instantes: formatearlas
   * en la zona local las correría un día en Bolivia (UTC-4).
   */
  private formatFecha(fecha: Date): string {
    return fecha.toLocaleDateString(LOCALE_DEFAULT, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  /**
   * El anexo no repite "Bs" fila por fila: el encabezado ya declara que todo
   * está expresado en bolivianos, igual que la planilla original.
   */
  private formatMonto(monto: Prisma.Decimal): string {
    return monto.toNumber().toLocaleString(LOCALE_DEFAULT, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async generatePdf(id: number, user: UsuarioContexto): Promise<Buffer> {
    const declaracion = await this.findOne(id, user);

    return this.pdfService.generatePdf('declaracion-movilidad.hbs', {
      codigoDeclaracion: declaracion.codigoDeclaracion,
      nombre: declaracion.usuario.nombreCompleto,
      cargo: declaracion.cargo,
      motivoActividad: declaracion.motivoActividad,
      proyectoPartida: declaracion.proyectoPartida,
      lugarEmision: declaracion.lugarEmision,
      fechaEmision: this.formatFecha(declaracion.fechaEmision),
      detalles: declaracion.detalles.map((detalle) => ({
        fecha: this.formatFecha(detalle.fecha),
        origen: detalle.origen,
        destino: detalle.destino,
        motivo: detalle.motivo,
        monto: this.formatMonto(detalle.monto),
      })),
      totalBruto: this.formatMonto(declaracion.totalBruto),
      retencion: this.formatMonto(declaracion.retencion),
      totalLiquido: this.formatMonto(declaracion.totalLiquido),
      generatedAt: formatDate(new Date()),
    });
  }
}
