import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCuadroComparativoDto } from './dto/create-cuadro-comparativo.dto';
import { UpdateCuadroComparativoDto } from './dto/update-cuadro-comparativo.dto';
import {
  Rol,
  Prisma,
  EstadoCuadroComparativo,
  TipoAccionHistorial,
} from '@prisma/client';
import { PdfService } from '../pdf/pdf.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { CUADRO_INCLUDE } from './cuadros-comparativos.constants';

type UsuarioContexto = { id: number; rol: Rol };

const ROLES_VISTA_GLOBAL: Rol[] = [Rol.ADMIN, Rol.EJECUTIVO];
const ROLES_VALIDADOR: Rol[] = [Rol.VALIDADOR_COMPRAS, Rol.ADMIN];
const ROLES_REVISOR: Rol[] = [Rol.CONTADOR, Rol.ADMIN];
const ROLES_APROBADOR: Rol[] = [Rol.EJECUTIVO, Rol.ADMIN];
const ESTADOS_EDITABLES: EstadoCuadroComparativo[] = [
  EstadoCuadroComparativo.BORRADOR,
  EstadoCuadroComparativo.OBSERVADO,
];

const REVISOR = {
  nombre: 'Shirley Ramirez Teodovich',
  cargo: 'Director Financiero',
};
const APROBADOR = {
  nombre: 'Marcos Teran Valenzuela',
  cargo: 'Director Ejecutivo',
};

@Injectable()
export class CuadrosComparativosService {
  private readonly logger = new Logger(CuadrosComparativosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  private async generarCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const anioActual = new Date().getFullYear();
    const count = await tx.cuadroComparativo.count({
      where: {
        createdAt: {
          gte: new Date(`${anioActual}-01-01`),
          lte: new Date(`${anioActual}-12-31`),
        },
      },
    });
    const correlativo = (count + 1).toString().padStart(3, '0');
    return `CUA-${anioActual}-${correlativo}`;
  }

  private esVistaGlobal(rol: Rol): boolean {
    return ROLES_VISTA_GLOBAL.includes(rol);
  }

  async create(dto: CreateCuadroComparativoDto, usuarioId: number) {
    const cotizacionIds = dto.cotizaciones.map((c) => c.cotizacionId);
    const cotizaciones = await this.prisma.cotizacion.findMany({
      where: { id: { in: cotizacionIds }, deletedAt: null },
      select: { id: true, proveedorNombre: true },
    });

    if (cotizaciones.length !== cotizacionIds.length) {
      throw new BadRequestException(
        'Una o más cotizaciones seleccionadas no existen o fueron eliminadas',
      );
    }

    const proveedorPorId = new Map(
      cotizaciones.map((c) => [c.id, c.proveedorNombre]),
    );

    return this.prisma.$transaction(async (tx) => {
      const codigoCuadro = await this.generarCodigo(tx);

      const cuadro = await tx.cuadroComparativo.create({
        data: {
          codigoCuadro,
          lugarFecha: dto.lugarFecha?.trim() || null,
          observaciones: dto.observaciones?.trim() || null,
          usuarioEmisorId: usuarioId,
        },
      });

      // Columnas (cotizaciones del cuadro)
      const colIdPorIndex: number[] = [];
      const totalPorIndex: Prisma.Decimal[] = dto.cotizaciones.map(
        () => new Prisma.Decimal(0),
      );

      for (let i = 0; i < dto.cotizaciones.length; i++) {
        const col = dto.cotizaciones[i];
        const creada = await tx.cuadroCotizacion.create({
          data: {
            orden: col.orden,
            proveedorNombre: proveedorPorId.get(col.cotizacionId) ?? 'N/D',
            cuadroId: cuadro.id,
            cotizacionId: col.cotizacionId,
          },
        });
        colIdPorIndex[i] = creada.id;
      }

      // Filas (ítems) + precios por columna
      for (const item of dto.items) {
        const cantidad = new Prisma.Decimal(item.cantidad);
        const ganadoraColId =
          item.ganadoraCotizacionIndex !== undefined
            ? colIdPorIndex[item.ganadoraCotizacionIndex]
            : null;

        const itemCreado = await tx.cuadroItem.create({
          data: {
            orden: item.orden,
            descripcion: item.descripcion.trim(),
            cantidad,
            unidad: item.unidad?.trim() || null,
            cuadroId: cuadro.id,
            cotizacionGanadoraId: ganadoraColId,
          },
        });

        for (const precio of item.precios) {
          const colId = colIdPorIndex[precio.cotizacionIndex];
          if (colId === undefined) {
            throw new BadRequestException(
              `Índice de cotización inválido en precios: ${precio.cotizacionIndex}`,
            );
          }

          const noMenciona = precio.noMenciona === true;
          const precioUnitario = noMenciona
            ? null
            : new Prisma.Decimal(precio.precioUnitario ?? 0);
          const total = noMenciona
            ? null
            : (precioUnitario as Prisma.Decimal).times(cantidad);

          if (total) {
            totalPorIndex[precio.cotizacionIndex] =
              totalPorIndex[precio.cotizacionIndex].plus(total);
          }

          await tx.cuadroPrecio.create({
            data: {
              precioUnitario,
              total,
              noMenciona,
              cuadroItemId: itemCreado.id,
              cuadroCotizacionId: colId,
            },
          });
        }
      }

      // Totales por columna
      for (let i = 0; i < colIdPorIndex.length; i++) {
        await tx.cuadroCotizacion.update({
          where: { id: colIdPorIndex[i] },
          data: { total: totalPorIndex[i] },
        });
      }

      // Cotización recomendada global
      if (dto.recomendadaCotizacionIndex !== undefined) {
        const recId = colIdPorIndex[dto.recomendadaCotizacionIndex];
        if (recId !== undefined) {
          await tx.cuadroComparativo.update({
            where: { id: cuadro.id },
            data: {
              cotizacionRecomendadaId: recId,
              totalRecomendado: totalPorIndex[dto.recomendadaCotizacionIndex],
            },
          });
        }
      }

      this.logger.log(
        `[create] usuarioId=${usuarioId} | codigo=${codigoCuadro} | columnas=${dto.cotizaciones.length} | items=${dto.items.length}`,
      );

      return tx.cuadroComparativo.findUniqueOrThrow({
        where: { id: cuadro.id },
        include: CUADRO_INCLUDE,
      });
    });
  }

  async findAll(user: UsuarioContexto) {
    let where: Prisma.CuadroComparativoWhereInput = { deletedAt: null };

    if (this.esVistaGlobal(user.rol)) {
      // ADMIN/EJECUTIVO ven todo
    } else if (user.rol === Rol.VALIDADOR_COMPRAS) {
      where = {
        deletedAt: null,
        OR: [
          { usuarioEmisorId: user.id },
          { estado: EstadoCuadroComparativo.EN_VALIDACION },
        ],
      };
    } else if (user.rol === Rol.CONTADOR) {
      where = {
        deletedAt: null,
        OR: [
          { usuarioEmisorId: user.id },
          { estado: EstadoCuadroComparativo.EN_REVISION },
          { estado: EstadoCuadroComparativo.REVISADO },
        ],
      };
    } else {
      where = { deletedAt: null, usuarioEmisorId: user.id };
    }

    return this.prisma.cuadroComparativo.findMany({
      where,
      include: CUADRO_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const cuadro = await this.prisma.cuadroComparativo.findFirst({
      where: { id, deletedAt: null },
      include: CUADRO_INCLUDE,
    });

    if (!cuadro) {
      throw new NotFoundException(`Cuadro comparativo ${id} no encontrado`);
    }

    return cuadro;
  }

  private asegurarPropietario(emisorId: number, user: UsuarioContexto): void {
    if (!this.esVistaGlobal(user.rol) && emisorId !== user.id) {
      throw new ForbiddenException(
        'No tienes permiso para modificar este cuadro comparativo',
      );
    }
  }

  async update(
    id: number,
    dto: UpdateCuadroComparativoDto,
    user: UsuarioContexto,
  ) {
    const cuadro = await this.findOne(id);
    this.asegurarPropietario(cuadro.usuarioEmisorId, user);

    if (!ESTADOS_EDITABLES.includes(cuadro.estado)) {
      throw new BadRequestException(
        `El cuadro no es editable en estado ${cuadro.estado}. Solo se puede editar en BORRADOR u OBSERVADO.`,
      );
    }

    // Si llegan estructuras nuevas, se reconstruye el cuadro completo.
    const reconstruir =
      dto.cotizaciones !== undefined || dto.items !== undefined;

    if (!reconstruir) {
      return this.prisma.cuadroComparativo.update({
        where: { id },
        data: {
          ...(dto.lugarFecha !== undefined
            ? { lugarFecha: dto.lugarFecha?.trim() || null }
            : {}),
          ...(dto.observaciones !== undefined
            ? { observaciones: dto.observaciones?.trim() || null }
            : {}),
        },
        include: CUADRO_INCLUDE,
      });
    }

    if (dto.cotizaciones === undefined || dto.items === undefined) {
      throw new BadRequestException(
        'Para reestructurar el cuadro se requieren cotizaciones e items',
      );
    }

    const dtoCompleto: CreateCuadroComparativoDto = {
      lugarFecha: dto.lugarFecha ?? cuadro.lugarFecha ?? undefined,
      observaciones: dto.observaciones ?? cuadro.observaciones ?? undefined,
      recomendadaCotizacionIndex: dto.recomendadaCotizacionIndex,
      cotizaciones: dto.cotizaciones,
      items: dto.items,
    };

    // Validar (solo lectura) que todas las cotizaciones existan ANTES de tocar
    // la base de datos, para no abrir la transacción si la entrada es inválida.
    const cotizacionIds = dtoCompleto.cotizaciones.map((c) => c.cotizacionId);
    const cotizaciones = await this.prisma.cotizacion.findMany({
      where: { id: { in: cotizacionIds }, deletedAt: null },
      select: { id: true, proveedorNombre: true },
    });

    if (cotizaciones.length !== cotizacionIds.length) {
      throw new BadRequestException(
        'Una o más cotizaciones seleccionadas no existen o fueron eliminadas',
      );
    }

    const proveedorPorId = new Map(
      cotizaciones.map((c) => [c.id, c.proveedorNombre]),
    );

    // Borrado + reconstrucción en UNA sola transacción: si la reconstrucción
    // falla, el borrado se revierte y el cuadro nunca queda en estado vacío.
    return this.prisma.$transaction(async (tx) => {
      // 1. Liberar la FK de cotización recomendada antes de borrar las columnas.
      await tx.cuadroComparativo.update({
        where: { id },
        data: {
          cotizacionRecomendadaId: null,
          totalRecomendado: null,
        },
      });

      // 2. Borrar la estructura anterior (precios -> items -> columnas).
      await tx.cuadroPrecio.deleteMany({
        where: { cuadroItem: { cuadroId: id } },
      });
      await tx.cuadroItem.deleteMany({ where: { cuadroId: id } });
      await tx.cuadroCotizacion.deleteMany({ where: { cuadroId: id } });

      // 3. Reconstruir dentro de la MISMA transacción.
      await this.construirEstructura(tx, id, dtoCompleto, proveedorPorId);

      return tx.cuadroComparativo.findUniqueOrThrow({
        where: { id },
        include: CUADRO_INCLUDE,
      });
    });
  }

  /**
   * Construye columnas, ítems, precios, totales y la cotización recomendada del
   * cuadro DENTRO de la transacción recibida. No abre su propia transacción ni
   * realiza lecturas: el llamador debe proveer el cliente transaccional y el
   * mapa de proveedores ya validado. Esto permite que el borrado previo y la
   * reconstrucción ocurran de forma atómica.
   */
  private async construirEstructura(
    tx: Prisma.TransactionClient,
    cuadroId: number,
    dto: CreateCuadroComparativoDto,
    proveedorPorId: Map<number, string>,
  ): Promise<void> {
    await tx.cuadroComparativo.update({
      where: { id: cuadroId },
      data: {
        lugarFecha: dto.lugarFecha?.trim() || null,
        observaciones: dto.observaciones?.trim() || null,
      },
    });

    const colIdPorIndex: number[] = [];
    const totalPorIndex: Prisma.Decimal[] = dto.cotizaciones.map(
      () => new Prisma.Decimal(0),
    );

    for (let i = 0; i < dto.cotizaciones.length; i++) {
      const col = dto.cotizaciones[i];
      const creada = await tx.cuadroCotizacion.create({
        data: {
          orden: col.orden,
          proveedorNombre: proveedorPorId.get(col.cotizacionId) ?? 'N/D',
          cuadroId,
          cotizacionId: col.cotizacionId,
        },
      });
      colIdPorIndex[i] = creada.id;
    }

    for (const item of dto.items) {
      const cantidad = new Prisma.Decimal(item.cantidad);
      const ganadoraColId =
        item.ganadoraCotizacionIndex !== undefined
          ? colIdPorIndex[item.ganadoraCotizacionIndex]
          : null;

      const itemCreado = await tx.cuadroItem.create({
        data: {
          orden: item.orden,
          descripcion: item.descripcion.trim(),
          cantidad,
          unidad: item.unidad?.trim() || null,
          cuadroId,
          cotizacionGanadoraId: ganadoraColId,
        },
      });

      for (const precio of item.precios) {
        const colId = colIdPorIndex[precio.cotizacionIndex];
        if (colId === undefined) {
          throw new BadRequestException(
            `Índice de cotización inválido en precios: ${precio.cotizacionIndex}`,
          );
        }

        const noMenciona = precio.noMenciona === true;
        const precioUnitario = noMenciona
          ? null
          : new Prisma.Decimal(precio.precioUnitario ?? 0);
        const total = noMenciona
          ? null
          : (precioUnitario as Prisma.Decimal).times(cantidad);

        if (total) {
          totalPorIndex[precio.cotizacionIndex] =
            totalPorIndex[precio.cotizacionIndex].plus(total);
        }

        await tx.cuadroPrecio.create({
          data: {
            precioUnitario,
            total,
            noMenciona,
            cuadroItemId: itemCreado.id,
            cuadroCotizacionId: colId,
          },
        });
      }
    }

    for (let i = 0; i < colIdPorIndex.length; i++) {
      await tx.cuadroCotizacion.update({
        where: { id: colIdPorIndex[i] },
        data: { total: totalPorIndex[i] },
      });
    }

    if (dto.recomendadaCotizacionIndex !== undefined) {
      const recId = colIdPorIndex[dto.recomendadaCotizacionIndex];
      if (recId !== undefined) {
        await tx.cuadroComparativo.update({
          where: { id: cuadroId },
          data: {
            cotizacionRecomendadaId: recId,
            totalRecomendado: totalPorIndex[dto.recomendadaCotizacionIndex],
          },
        });
      }
    }
  }

  async remove(id: number, user: UsuarioContexto) {
    const cuadro = await this.findOne(id);
    this.asegurarPropietario(cuadro.usuarioEmisorId, user);

    await this.prisma.cuadroComparativo.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Cuadro comparativo eliminado correctamente' };
  }

  private async registrarHistorial(data: {
    accion: TipoAccionHistorial;
    comentario?: string;
    usuarioId: number;
    cuadroComparativoId: number;
  }) {
    await this.prisma.historialAprobacion.create({
      data: {
        accion: data.accion,
        comentario: data.comentario ?? null,
        usuarioId: data.usuarioId,
        cuadroComparativoId: data.cuadroComparativoId,
      },
    });
  }

  private async notificarRol(
    rol: Rol,
    cuadroId: number,
    titulo: string,
    mensaje: string,
    tipo:
      | 'CUADRO_PENDIENTE_VALIDACION'
      | 'CUADRO_PENDIENTE_REVISION'
      | 'CUADRO_OBSERVADO'
      | 'CUADRO_APROBADO',
  ) {
    const usuarios = await this.prisma.usuario.findMany({
      where: { rol, deletedAt: null },
      select: { id: true },
    });
    for (const u of usuarios) {
      await this.notificaciones.crearNotificacion({
        titulo,
        mensaje,
        tipo,
        usuarioId: u.id,
        cuadroComparativoId: cuadroId,
        urlDestino: `/app/cuadros-comparativos/${cuadroId}`,
      });
    }
  }

  private async notificarUsuario(
    usuarioId: number,
    cuadroId: number,
    titulo: string,
    mensaje: string,
    tipo: 'CUADRO_OBSERVADO' | 'CUADRO_APROBADO',
  ) {
    await this.notificaciones.crearNotificacion({
      titulo,
      mensaje,
      tipo,
      usuarioId,
      cuadroComparativoId: cuadroId,
      urlDestino: `/app/cuadros-comparativos/${cuadroId}`,
    });
  }

  /**
   * PASO 1 — Emisor envía al CONTADOR para revisión inicial.
   * BORRADOR | OBSERVADO → EN_REVISION
   */
  async enviarARevision(id: number, user: UsuarioContexto) {
    const cuadro = await this.findOne(id);
    this.asegurarPropietario(cuadro.usuarioEmisorId, user);

    if (!ESTADOS_EDITABLES.includes(cuadro.estado)) {
      throw new BadRequestException(
        `Solo se puede enviar a revisión un cuadro en BORRADOR u OBSERVADO (estado actual: ${cuadro.estado}).`,
      );
    }

    await this.prisma.cuadroComparativo.update({
      where: { id },
      data: {
        estado: EstadoCuadroComparativo.EN_REVISION,
        motivoObservacion: null,
      },
    });

    await this.registrarHistorial({
      accion: TipoAccionHistorial.ENVIADO,
      comentario: 'Enviado a revisión (CONTADOR)',
      usuarioId: user.id,
      cuadroComparativoId: id,
    });

    await this.notificarRol(
      Rol.CONTADOR,
      id,
      'Cuadro comparativo por revisar',
      `El cuadro ${cuadro.codigoCuadro} requiere tu revisión.`,
      'CUADRO_PENDIENTE_REVISION',
    );

    return this.findOne(id);
  }

  /**
   * PASO 2 — CONTADOR envía a Denis (VALIDADOR_COMPRAS) para validación.
   * EN_REVISION → EN_VALIDACION
   */
  async enviarAValidacion(id: number, user: UsuarioContexto) {
    const cuadro = await this.findOne(id);

    if (!ROLES_REVISOR.includes(user.rol)) {
      throw new ForbiddenException(
        'Solo el CONTADOR puede enviar el cuadro a validación.',
      );
    }

    if (cuadro.estado !== EstadoCuadroComparativo.EN_REVISION) {
      throw new BadRequestException(
        `Solo se puede enviar a validación un cuadro EN_REVISION (estado actual: ${cuadro.estado}).`,
      );
    }

    await this.prisma.cuadroComparativo.update({
      where: { id },
      data: { estado: EstadoCuadroComparativo.EN_VALIDACION },
    });

    await this.registrarHistorial({
      accion: TipoAccionHistorial.DERIVADO,
      comentario: 'Enviado a validación (VALIDADOR_COMPRAS)',
      usuarioId: user.id,
      cuadroComparativoId: id,
    });

    await this.notificarRol(
      Rol.VALIDADOR_COMPRAS,
      id,
      'Cuadro comparativo por validar',
      `El cuadro ${cuadro.codigoCuadro} requiere tu validación.`,
      'CUADRO_PENDIENTE_VALIDACION',
    );

    return this.findOne(id);
  }

  /**
   * PASO 3 — Denis (VALIDADOR_COMPRAS) valida y devuelve al CONTADOR.
   * EN_VALIDACION → REVISADO
   */
  async validar(id: number, user: UsuarioContexto) {
    const cuadro = await this.findOne(id);

    if (!ROLES_VALIDADOR.includes(user.rol)) {
      throw new ForbiddenException(
        'Solo el VALIDADOR_COMPRAS puede validar el cuadro.',
      );
    }

    if (cuadro.estado !== EstadoCuadroComparativo.EN_VALIDACION) {
      throw new BadRequestException(
        `Solo se puede validar un cuadro EN_VALIDACION (estado actual: ${cuadro.estado}).`,
      );
    }

    await this.prisma.cuadroComparativo.update({
      where: { id },
      data: { estado: EstadoCuadroComparativo.REVISADO },
    });

    await this.registrarHistorial({
      accion: TipoAccionHistorial.VALIDADO,
      comentario: 'Validado por VALIDADOR_COMPRAS — listo para aprobación',
      usuarioId: user.id,
      cuadroComparativoId: id,
    });

    await this.notificarRol(
      Rol.CONTADOR,
      id,
      'Cuadro comparativo validado',
      `El cuadro ${cuadro.codigoCuadro} fue validado. Envíalo a aprobación final.`,
      'CUADRO_PENDIENTE_REVISION',
    );

    return this.findOne(id);
  }

  /**
   * PASO 4 — CONTADOR envía a Shirley (EJECUTIVO) para aprobación final.
   * REVISADO → EN_APROBACION
   */
  async enviarAAprobacion(id: number, user: UsuarioContexto) {
    const cuadro = await this.findOne(id);

    if (!ROLES_REVISOR.includes(user.rol)) {
      throw new ForbiddenException(
        'Solo el CONTADOR puede enviar el cuadro a aprobación final.',
      );
    }

    if (cuadro.estado !== EstadoCuadroComparativo.REVISADO) {
      throw new BadRequestException(
        `Solo se puede enviar a aprobación un cuadro REVISADO (estado actual: ${cuadro.estado}).`,
      );
    }

    await this.prisma.cuadroComparativo.update({
      where: { id },
      data: { estado: EstadoCuadroComparativo.EN_APROBACION },
    });

    await this.registrarHistorial({
      accion: TipoAccionHistorial.DERIVADO,
      comentario: 'Enviado a aprobación final (EJECUTIVO)',
      usuarioId: user.id,
      cuadroComparativoId: id,
    });

    await this.notificarRol(
      Rol.EJECUTIVO,
      id,
      'Cuadro comparativo por aprobar',
      `El cuadro ${cuadro.codigoCuadro} requiere tu aprobación final.`,
      'CUADRO_PENDIENTE_REVISION',
    );

    return this.findOne(id);
  }

  /**
   * PASO 5 — Shirley (EJECUTIVO) aprueba.
   * EN_APROBACION → APROBADO
   */
  async aprobar(id: number, user: UsuarioContexto) {
    const cuadro = await this.findOne(id);

    if (!ROLES_APROBADOR.includes(user.rol)) {
      throw new ForbiddenException(
        'Solo el EJECUTIVO puede aprobar el cuadro.',
      );
    }

    if (cuadro.estado !== EstadoCuadroComparativo.EN_APROBACION) {
      throw new BadRequestException(
        `Solo se puede aprobar un cuadro EN_APROBACION (estado actual: ${cuadro.estado}).`,
      );
    }

    await this.prisma.cuadroComparativo.update({
      where: { id },
      data: { estado: EstadoCuadroComparativo.APROBADO },
    });

    await this.registrarHistorial({
      accion: TipoAccionHistorial.APROBADO,
      comentario: 'Aprobado por EJECUTIVO',
      usuarioId: user.id,
      cuadroComparativoId: id,
    });

    await this.notificarUsuario(
      cuadro.usuarioEmisorId,
      id,
      'Cuadro comparativo aprobado',
      `Tu cuadro ${cuadro.codigoCuadro} fue aprobado.`,
      'CUADRO_APROBADO',
    );

    return this.findOne(id);
  }

  /**
   * Observar — cualquier revisor activo puede devolver al emisor.
   * EN_REVISION | EN_VALIDACION | REVISADO | EN_APROBACION → OBSERVADO
   */
  async observar(id: number, user: UsuarioContexto, motivo: string) {
    const cuadro = await this.findOne(id);

    const puedeObservar =
      (cuadro.estado === EstadoCuadroComparativo.EN_REVISION &&
        ROLES_REVISOR.includes(user.rol)) ||
      (cuadro.estado === EstadoCuadroComparativo.EN_VALIDACION &&
        ROLES_VALIDADOR.includes(user.rol)) ||
      (cuadro.estado === EstadoCuadroComparativo.REVISADO &&
        ROLES_REVISOR.includes(user.rol)) ||
      (cuadro.estado === EstadoCuadroComparativo.EN_APROBACION &&
        ROLES_APROBADOR.includes(user.rol));

    if (!puedeObservar) {
      throw new ForbiddenException(
        `No tienes permiso para observar un cuadro en estado ${cuadro.estado}.`,
      );
    }

    await this.prisma.cuadroComparativo.update({
      where: { id },
      data: {
        estado: EstadoCuadroComparativo.OBSERVADO,
        motivoObservacion: motivo.trim(),
      },
    });

    await this.registrarHistorial({
      accion: TipoAccionHistorial.OBSERVADO,
      comentario: motivo.trim(),
      usuarioId: user.id,
      cuadroComparativoId: id,
    });

    await this.notificarUsuario(
      cuadro.usuarioEmisorId,
      id,
      'Cuadro comparativo observado',
      `Tu cuadro ${cuadro.codigoCuadro} fue observado: ${motivo.trim()}`,
      'CUADRO_OBSERVADO',
    );

    return this.findOne(id);
  }

  async generatePdf(id: number): Promise<Buffer> {
    const cuadro = await this.findOne(id);

    const columnas = cuadro.cotizaciones.map((col) => ({
      id: col.id,
      orden: col.orden,
      proveedorNombre: col.proveedorNombre,
      total: this.formatNumber(Number(col.total ?? 0)),
      recomendada: cuadro.cotizacionRecomendadaId === col.id,
    }));

    const items = cuadro.items.map((item) => {
      const preciosPorColId = new Map(
        item.precios.map((p) => [p.cuadroCotizacionId, p]),
      );

      const celdas = cuadro.cotizaciones.map((col) => {
        const p = preciosPorColId.get(col.id);
        const noMenciona = p?.noMenciona ?? true;
        return {
          noMenciona,
          ganadora: item.cotizacionGanadoraId === col.id,
          precioUnitario: noMenciona
            ? ''
            : this.formatNumber(Number(p?.precioUnitario ?? 0)),
          total: noMenciona ? '' : this.formatNumber(Number(p?.total ?? 0)),
        };
      });

      return {
        orden: item.orden,
        descripcion: item.descripcion,
        cantidad: this.formatCantidad(Number(item.cantidad ?? 0)),
        unidad: item.unidad ?? '',
        celdas,
      };
    });

    const emisorNombre = cuadro.usuarioEmisor?.nombreCompleto ?? '';
    const emisorCargo = cuadro.usuarioEmisor?.cargo ?? 'Resp. Cotización';

    return this.pdfService.generatePdf(
      'cuadro-comparativo.hbs',
      {
        codigoCuadro: cuadro.codigoCuadro,
        lugarFecha: cuadro.lugarFecha ?? '',
        observaciones: cuadro.observaciones ?? '',
        columnas,
        columnasCount: columnas.length,
        colspanCotizaciones: columnas.length * 2,
        items,
        preparadoPor: emisorNombre,
        preparadoCargo: emisorCargo,
        revisadoPor: REVISOR.nombre,
        revisadoCargo: REVISOR.cargo,
        aprobadoPor: APROBADOR.nombre,
        aprobadoCargo: APROBADOR.cargo,
      },
      { landscape: true },
    );
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private formatCantidad(value: number): string {
    return new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }
}
