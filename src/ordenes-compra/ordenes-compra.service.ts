import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';
import { Rol, Prisma } from '@prisma/client';
import {
  ORDEN_INCLUDE,
  DIRECTOR_FINANCIERO,
  DIRECTOR_EJECUTIVO,
  ACEAA_NIT,
  ACEAA_TC,
} from './ordenes-compra.constants';

type UsuarioContexto = { id: number; rol: Rol };

const ROLES_VISTA_GLOBAL: Rol[] = [Rol.ADMIN, Rol.EJECUTIVO];

@Injectable()
export class OrdenesCompraService {
  private readonly logger = new Logger(OrdenesCompraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  private esVistaGlobal(rol: Rol): boolean {
    return ROLES_VISTA_GLOBAL.includes(rol);
  }

  private async generarCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const anio = new Date().getFullYear();
    const count = await tx.ordenCompra.count({
      where: {
        createdAt: {
          gte: new Date(`${anio}-01-01`),
          lte: new Date(`${anio}-12-31`),
        },
      },
    });
    return `OC-${anio}-${(count + 1).toString().padStart(3, '0')}`;
  }

  async prefillFromCuadro(cuadroId: number) {
    const cuadro = await this.prisma.cuadroComparativo.findFirst({
      where: { id: cuadroId, deletedAt: null },
      include: {
        cotizacionRecomendada: {
          include: {
            cotizacion: {
              select: {
                proveedorNombre: true,
                proveedorDireccion: true,
                proveedorTelefono: true,
                garantia: true,
              },
            },
          },
        },
        items: {
          orderBy: { orden: 'asc' },
          include: { precios: true },
        },
      },
    });

    if (!cuadro) {
      throw new NotFoundException(
        `Cuadro comparativo ${cuadroId} no encontrado`,
      );
    }

    if (cuadro.estado !== 'APROBADO') {
      throw new BadRequestException(
        'Solo se puede prellenar desde un cuadro comparativo APROBADO',
      );
    }

    if (!cuadro.cotizacionRecomendadaId || !cuadro.cotizacionRecomendada) {
      throw new BadRequestException(
        'El cuadro comparativo no tiene una cotización recomendada definida',
      );
    }

    const recomendada = cuadro.cotizacionRecomendada;
    const cotizacion = recomendada.cotizacion;

    const items = cuadro.items
      .map((item) => {
        const precio = item.precios.find(
          (p) => p.cuadroCotizacionId === recomendada.id && !p.noMenciona,
        );
        return { item, precio };
      })
      .filter(({ precio }) => precio !== undefined)
      .map(({ item, precio }, idx) => {
        const precioUnitario = Number(precio!.precioUnitario ?? 0);
        const cantidad = Number(item.cantidad ?? 0);
        return {
          orden: idx + 1,
          item: item.descripcion,
          cantidad,
          unidad: item.unidad ?? '',
          detalle: '',
          precioUnitario,
          total: precioUnitario * cantidad,
          cuadroItemId: item.id,
          sinCuadro: false,
        };
      });

    return {
      cuadroComparativoId: cuadro.id,
      cuadroCodigoCuadro: cuadro.codigoCuadro,
      proveedorNombre: cotizacion.proveedorNombre,
      proveedorDireccion: cotizacion.proveedorDireccion ?? '',
      proveedorTelefono: cotizacion.proveedorTelefono ?? '',
      garantia: cotizacion.garantia ?? 'N/A',
      formaPago: 'Transferencia bancaria',
      items,
    };
  }

  async create(dto: CreateOrdenCompraDto, usuarioId: number) {
    return this.prisma.$transaction(async (tx) => {
      const codigoOrden = await this.generarCodigo(tx);

      const total = dto.items.reduce((acc, it) => {
        return acc + Number(it.precioUnitario) * Number(it.cantidad);
      }, 0);

      const orden = await tx.ordenCompra.create({
        data: {
          codigoOrden,
          proveedorNombre: dto.proveedorNombre.trim(),
          proveedorDireccion: dto.proveedorDireccion?.trim() || null,
          proveedorTelefono: dto.proveedorTelefono?.trim() || null,
          lugarEntrega: dto.lugarEntrega?.trim() || null,
          formaPago: dto.formaPago?.trim() || 'Transferencia bancaria',
          garantia: dto.garantia?.trim() || 'N/A',
          observaciones: dto.observaciones?.trim() || null,
          total: new Prisma.Decimal(total),
          cuadroComparativoId: dto.cuadroComparativoId ?? null,
          usuarioEmisorId: usuarioId,
        },
      });

      for (const it of dto.items) {
        const precioUnitario = new Prisma.Decimal(it.precioUnitario);
        const cantidad = new Prisma.Decimal(it.cantidad);
        const itemTotal = precioUnitario.times(cantidad);

        await tx.ordenCompraItem.create({
          data: {
            orden: it.orden,
            item: it.item.trim(),
            cantidad,
            unidad: it.unidad?.trim() || null,
            detalle: it.detalle?.trim() || null,
            precioUnitario,
            total: itemTotal,
            cuadroItemId: it.cuadroItemId ?? null,
            sinCuadro: it.sinCuadro ?? false,
            ordenCompraId: orden.id,
          },
        });
      }

      this.logger.log(
        `[create] usuarioId=${usuarioId} | codigo=${codigoOrden} | items=${dto.items.length} | total=${total}`,
      );

      return tx.ordenCompra.findUniqueOrThrow({
        where: { id: orden.id },
        include: ORDEN_INCLUDE,
      });
    });
  }

  async findAll(user: UsuarioContexto) {
    const where: Prisma.OrdenCompraWhereInput = this.esVistaGlobal(user.rol)
      ? { deletedAt: null }
      : { deletedAt: null, usuarioEmisorId: user.id };

    return this.prisma.ordenCompra.findMany({
      where,
      include: ORDEN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number, user?: UsuarioContexto) {
    const orden = await this.prisma.ordenCompra.findFirst({
      where: { id, deletedAt: null },
      include: ORDEN_INCLUDE,
    });

    if (!orden) {
      throw new NotFoundException(`Orden de compra ${id} no encontrada`);
    }

    if (user) {
      this.asegurarAcceso(orden.usuarioEmisorId, user);
    }

    return orden;
  }

  // Misma visibilidad que findAll: ADMIN/EJECUTIVO acceden a todo; el resto
  // solo a sus propias órdenes. Sin usuario (uso interno) no se valida.
  private asegurarAcceso(emisorId: number, user: UsuarioContexto): void {
    if (!this.esVistaGlobal(user.rol) && emisorId !== user.id) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a esta orden de compra',
      );
    }
  }

  async update(id: number, dto: CreateOrdenCompraDto, user: UsuarioContexto) {
    const orden = await this.findOne(id);

    if (!this.esVistaGlobal(user.rol) && orden.usuarioEmisorId !== user.id) {
      throw new ForbiddenException(
        'No tienes permiso para modificar esta orden de compra',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.ordenCompraItem.deleteMany({ where: { ordenCompraId: id } });

      const total = dto.items.reduce((acc, it) => {
        return acc + Number(it.precioUnitario) * Number(it.cantidad);
      }, 0);

      await tx.ordenCompra.update({
        where: { id },
        data: {
          proveedorNombre: dto.proveedorNombre.trim(),
          proveedorDireccion: dto.proveedorDireccion?.trim() || null,
          proveedorTelefono: dto.proveedorTelefono?.trim() || null,
          lugarEntrega: dto.lugarEntrega?.trim() || null,
          formaPago: dto.formaPago?.trim() || 'Transferencia bancaria',
          garantia: dto.garantia?.trim() || 'N/A',
          observaciones: dto.observaciones?.trim() || null,
          total: new Prisma.Decimal(total),
          cuadroComparativoId: dto.cuadroComparativoId ?? null,
        },
      });

      for (const it of dto.items) {
        const precioUnitario = new Prisma.Decimal(it.precioUnitario);
        const cantidad = new Prisma.Decimal(it.cantidad);
        await tx.ordenCompraItem.create({
          data: {
            orden: it.orden,
            item: it.item.trim(),
            cantidad,
            unidad: it.unidad?.trim() || null,
            detalle: it.detalle?.trim() || null,
            precioUnitario,
            total: precioUnitario.times(cantidad),
            cuadroItemId: it.cuadroItemId ?? null,
            sinCuadro: it.sinCuadro ?? false,
            ordenCompraId: id,
          },
        });
      }

      return tx.ordenCompra.findUniqueOrThrow({
        where: { id },
        include: ORDEN_INCLUDE,
      });
    });
  }

  async remove(id: number, user: UsuarioContexto) {
    const orden = await this.findOne(id);

    if (!this.esVistaGlobal(user.rol) && orden.usuarioEmisorId !== user.id) {
      throw new ForbiddenException(
        'No tienes permiso para eliminar esta orden de compra',
      );
    }

    await this.prisma.ordenCompra.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Orden de compra eliminada correctamente' };
  }

  async generatePdf(id: number, user?: UsuarioContexto): Promise<Buffer> {
    const orden = await this.findOne(id, user);

    const items = orden.items.map((it) => ({
      orden: it.orden,
      item: it.item,
      cantidad: this.fmt(Number(it.cantidad), 0),
      unidad: it.unidad ?? '',
      detalle: it.detalle ?? '',
      precioUnitario: this.fmtMoney(Number(it.precioUnitario)),
      total: this.fmtMoney(Number(it.total)),
      sinCuadro: it.sinCuadro,
    }));

    const totalNum = Number(orden.total);

    return this.pdfService.generatePdf('orden-compra.hbs', {
      codigoOrden: orden.codigoOrden,
      fecha: this.formatFecha(orden.fecha),
      proveedorNombre: orden.proveedorNombre,
      proveedorDireccion: orden.proveedorDireccion ?? '',
      proveedorTelefono: orden.proveedorTelefono ?? '',
      lugarEntrega: orden.lugarEntrega ?? '',
      formaPago: orden.formaPago,
      garantia: orden.garantia,
      observaciones: orden.observaciones ?? '',
      nit: ACEAA_NIT,
      tc: ACEAA_TC,
      items,
      total: this.fmtMoney(totalNum),
      totalLetras: this.numeroALetras(totalNum),
      directorFinanciero: DIRECTOR_FINANCIERO.nombre,
      cargoDirectorFinanciero: DIRECTOR_FINANCIERO.cargo,
      directorEjecutivo: DIRECTOR_EJECUTIVO.nombre,
      cargoDirectorEjecutivo: DIRECTOR_EJECUTIVO.cargo,
      preparadoPor: orden.usuarioEmisor?.nombreCompleto ?? '',
      cuadroCodigo: orden.cuadroComparativo?.codigoCuadro ?? '',
    });
  }

  private fmt(value: number, decimals: number): string {
    return new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  private fmtMoney(value: number): string {
    return new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private formatFecha(date: Date): string {
    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  private numeroALetras(num: number): string {
    const entero = Math.floor(num);
    const centavos = Math.round((num - entero) * 100);

    const letras = this.enterALetras(entero);
    const fraccion =
      centavos > 0
        ? ` con ${centavos.toString().padStart(2, '0')}/100`
        : ' con 00/100';

    return `${letras.toUpperCase()} BOLIVIANOS${fraccion}`;
  }

  private enterALetras(n: number): string {
    if (n === 0) return 'cero';
    if (n < 0) return `menos ${this.enterALetras(-n)}`;

    const unidades = [
      '',
      'uno',
      'dos',
      'tres',
      'cuatro',
      'cinco',
      'seis',
      'siete',
      'ocho',
      'nueve',
    ];
    const especiales = [
      'diez',
      'once',
      'doce',
      'trece',
      'catorce',
      'quince',
      'dieciséis',
      'diecisiete',
      'dieciocho',
      'diecinueve',
    ];
    const decenas = [
      '',
      '',
      'veinte',
      'treinta',
      'cuarenta',
      'cincuenta',
      'sesenta',
      'setenta',
      'ochenta',
      'noventa',
    ];
    const centenas = [
      '',
      'ciento',
      'doscientos',
      'trescientos',
      'cuatrocientos',
      'quinientos',
      'seiscientos',
      'setecientos',
      'ochocientos',
      'novecientos',
    ];

    if (n === 100) return 'cien';
    if (n < 10) return unidades[n];
    if (n < 20) return especiales[n - 10];
    if (n < 30) {
      return n === 20 ? 'veinte' : `veinti${unidades[n - 20]}`;
    }
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return u === 0 ? decenas[d] : `${decenas[d]} y ${unidades[u]}`;
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const resto = n % 100;
      return resto === 0
        ? centenas[c]
        : `${centenas[c]} ${this.enterALetras(resto)}`;
    }
    if (n < 2000) {
      const resto = n % 1000;
      return resto === 0 ? 'mil' : `mil ${this.enterALetras(resto)}`;
    }
    if (n < 1000000) {
      const miles = Math.floor(n / 1000);
      const resto = n % 1000;
      return resto === 0
        ? `${this.enterALetras(miles)} mil`
        : `${this.enterALetras(miles)} mil ${this.enterALetras(resto)}`;
    }
    return n.toString();
  }
}
