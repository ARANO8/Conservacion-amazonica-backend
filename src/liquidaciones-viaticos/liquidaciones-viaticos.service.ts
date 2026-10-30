import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoLiquidacionViaticos,
  Prisma,
  Rol,
  TipoAccionHistorial,
  TipoSolicitud,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentoPdf, PdfService, documentoPdf } from '../pdf/pdf.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { tarifaEnBolivianos } from '../common/constants/financial.constants';
import { ESTADOS_SOLICITUD_INFORMABLE } from '../informes-viaje/informes-viaje.constants';
import {
  CreateHojaLiquidacionDto,
  CreateLiquidacionViaticosDto,
} from './dto/create-liquidacion-viaticos.dto';
import { UpdateLiquidacionViaticosDto } from './dto/update-liquidacion-viaticos.dto';
import { ObservarLiquidacionViaticosDto } from './dto/observar-liquidacion-viaticos.dto';
import {
  LIQUIDACION_INCLUDE,
  LiquidacionCompleta,
} from './liquidaciones-viaticos.constants';
import {
  calcularFila,
  escalaPredominante,
  precargarFilasPorPersona,
  totalizarHoja,
} from './liquidacion.helper';
import { construirAnexo5 } from './anexo5.builder';

/** ADMIN y EJECUTIVO ven las liquidaciones de todos. */
const ROLES_VISTA_GLOBAL: Rol[] = [Rol.ADMIN, Rol.EJECUTIVO];

const ESTADOS_EDITABLES: EstadoLiquidacionViaticos[] = [
  EstadoLiquidacionViaticos.BORRADOR,
  EstadoLiquidacionViaticos.OBSERVADO,
];

interface UsuarioContexto {
  id: number;
  rol: Rol;
}

/** Lo que se necesita de la solicitud para liquidar su viaje. */
const SOLICITUD_PARA_LIQUIDAR = {
  directorPrograma: { select: { id: true, nombreCompleto: true, rol: true } },
  planViaje: { select: { objetivoViaje: true, lugaresViaje: true } },
  viaticos: {
    include: {
      concepto: { select: { nombre: true } },
      planificaciones: {
        select: {
          participantesInstitucionales: { select: { id: true } },
        },
      },
    },
  },
  liquidacionViaticos: { select: { id: true, deletedAt: true } },
} satisfies Prisma.SolicitudInclude;

type SolicitudParaLiquidar = Prisma.SolicitudGetPayload<{
  include: typeof SOLICITUD_PARA_LIQUIDAR;
}>;

/** Hoja con sus filas ya calculadas, lista para guardar. */
interface HojaCalculada {
  dto: CreateHojaLiquidacionDto;
  /** La del formulario o, si viene vacía, la del perfil del usuario */
  ci: string;
  escala: string;
  totales: ReturnType<typeof totalizarHoja>;
  filas: {
    conceptoId: number;
    porcentaje: number;
    dias: Prisma.Decimal;
    tarifaLiquida: Prisma.Decimal;
    totalLiquido: Prisma.Decimal;
    totalBruto: Prisma.Decimal;
    solicitudPresupuestoId: number | null;
  }[];
}

function activa<S extends { deletedAt: Date | null }>(v: S | null): S | null {
  return v && !v.deletedAt ? v : null;
}

@Injectable()
export class LiquidacionesViaticosService {
  private readonly logger = new Logger(LiquidacionesViaticosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  private esVistaGlobal(rol: Rol): boolean {
    return ROLES_VISTA_GLOBAL.includes(rol);
  }

  private async generarCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const anio = new Date().getFullYear();
    const count = await tx.liquidacionViaticos.count({
      where: {
        createdAt: {
          gte: new Date(`${anio}-01-01`),
          lte: new Date(`${anio}-12-31T23:59:59.999Z`),
        },
      },
    });
    return `LV-${anio}-${(count + 1).toString().padStart(3, '0')}`;
  }

  /** Director propuesto: el de la solicitud, si puede revisar. */
  private directorPropuesto(solicitud: SolicitudParaLiquidar): number | null {
    const d = solicitud.directorPrograma;
    return d && d.rol !== Rol.TESORERO && d.id !== solicitud.usuarioEmisorId
      ? d.id
      : null;
  }

  private async validarRevisor(
    directorProgramaId: number | null | undefined,
    autorId: number,
  ): Promise<void> {
    if (directorProgramaId == null) return;
    if (directorProgramaId === autorId) {
      throw new BadRequestException(
        'El revisor no puede ser el mismo autor de la liquidación',
      );
    }
    const director = await this.prisma.usuario.findFirst({
      where: { id: directorProgramaId, deletedAt: null },
      select: { rol: true },
    });
    if (!director) {
      throw new BadRequestException(
        'El Director de Programa seleccionado no existe o está inactivo',
      );
    }
    if (director.rol === Rol.TESORERO) {
      throw new BadRequestException(
        'Dirección Financiera no puede revisar la liquidación como Director de Programa',
      );
    }
  }

  private async obtenerSolicitud(
    solicitudId: number,
    autorId: number,
  ): Promise<SolicitudParaLiquidar> {
    const solicitud = await this.prisma.solicitud.findFirst({
      where: { id: solicitudId, deletedAt: null },
      include: SOLICITUD_PARA_LIQUIDAR,
    });
    if (!solicitud) {
      throw new BadRequestException(`Solicitud ${solicitudId} no encontrada`);
    }
    if (solicitud.tipo !== TipoSolicitud.VIAJE) {
      throw new BadRequestException(
        'La liquidación de viáticos solo aplica a solicitudes de viaje',
      );
    }
    if (solicitud.usuarioEmisorId !== autorId) {
      throw new ForbiddenException(
        'Solo puedes liquidar los viáticos de tus propias solicitudes',
      );
    }
    if (!ESTADOS_SOLICITUD_INFORMABLE.includes(solicitud.estado)) {
      throw new BadRequestException(
        'La solicitud aún no fue desembolsada: no hay viáticos que liquidar',
      );
    }
    if (activa(solicitud.liquidacionViaticos)) {
      throw new BadRequestException(
        `La solicitud ${solicitud.codigoSolicitud} ya tiene su liquidación de viáticos`,
      );
    }
    return solicitud;
  }

  /** Tarifas líquidas vigentes por concepto, en Bs. */
  private async tarifasVigentes() {
    const conceptos = await this.prisma.concepto.findMany();
    return new Map(
      conceptos.map((c) => [
        c.id,
        {
          nombre: c.nombre,
          tarifa: tarifaEnBolivianos(c.precioInstitucional, c.moneda),
        },
      ]),
    );
  }

  /**
   * Las hojas se recalculan siempre en el servidor con las tarifas vigentes:
   * del cliente solo viajan tarifa, porcentaje y días.
   */
  private async calcularHojas(
    hojas: CreateHojaLiquidacionDto[],
    solicitudId: number,
    partidaPorDefecto: number | null,
  ): Promise<HojaCalculada[]> {
    const usuarios = hojas.map((h) => h.usuarioId);
    if (new Set(usuarios).size !== usuarios.length) {
      throw new BadRequestException(
        'Una persona no puede tener dos hojas en la misma liquidación',
      );
    }
    const activos = new Map(
      (
        await this.prisma.usuario.findMany({
          where: { id: { in: usuarios }, deletedAt: null },
          select: { id: true, ci: true },
        })
      ).map((u) => [u.id, u.ci]),
    );
    if (activos.size !== usuarios.length) {
      throw new BadRequestException(
        'Una o más personas no existen o están inactivas',
      );
    }

    const partidas = new Set(
      (
        await this.prisma.solicitudPresupuesto.findMany({
          where: { solicitudId },
          select: { id: true },
        })
      ).map((p) => p.id),
    );
    const tarifas = await this.tarifasVigentes();

    return hojas.map((dto) => {
      if (new Date(dto.fechaRetorno) < new Date(dto.fechaSalida)) {
        throw new BadRequestException(
          'La fecha de retorno no puede ser anterior a la de salida',
        );
      }
      const filas = dto.filas.map((f) => {
        const concepto = tarifas.get(f.conceptoId);
        if (!concepto) {
          throw new BadRequestException(`Tarifa ${f.conceptoId} no existe`);
        }
        const partida = f.solicitudPresupuestoId ?? partidaPorDefecto;
        if (partida !== null && !partidas.has(partida)) {
          throw new BadRequestException(
            'La partida de una fila no pertenece a la solicitud',
          );
        }
        const dias = new Prisma.Decimal(f.dias);
        return {
          conceptoId: f.conceptoId,
          nombre: concepto.nombre,
          porcentaje: f.porcentaje,
          dias,
          tarifaLiquida: concepto.tarifa,
          solicitudPresupuestoId: partida,
          ...calcularFila(concepto.tarifa, dias, f.porcentaje),
        };
      });

      return {
        dto,
        ci: dto.ci?.trim() || activos.get(dto.usuarioId) || '',
        escala:
          dto.escala?.trim() ||
          escalaPredominante(
            filas.map((f) => ({ nombreConcepto: f.nombre, dias: f.dias })),
          ),
        totales: totalizarHoja(filas),
        filas: filas.map((f) => ({
          conceptoId: f.conceptoId,
          porcentaje: f.porcentaje,
          dias: f.dias,
          tarifaLiquida: f.tarifaLiquida,
          totalLiquido: f.totalLiquido,
          totalBruto: f.totalBruto,
          solicitudPresupuestoId: f.solicitudPresupuestoId,
        })),
      };
    });
  }

  private datosHoja(h: HojaCalculada, orden: number) {
    return {
      orden,
      usuarioId: h.dto.usuarioId,
      cargo: h.dto.cargo.trim(),
      ci: h.ci,
      sede: h.dto.sede?.trim() || 'La Paz',
      via: h.dto.via?.trim() ?? '',
      escala: h.escala,
      motivoViaje: h.dto.motivoViaje.trim(),
      destino: h.dto.destino.trim(),
      fechaSalida: h.dto.fechaSalida,
      fechaRetorno: h.dto.fechaRetorno,
      totalLiquido: h.totales.totalLiquido,
      totalBruto: h.totales.totalBruto,
      rcIva: h.totales.rcIva,
      filas: {
        create: h.filas.map((f, i) => ({ ...f, orden: i })),
      },
    };
  }

  /** Partida del primer viático institucional: la de las filas agregadas a mano. */
  private partidaDeViaticos(solicitud: SolicitudParaLiquidar): number | null {
    return (
      solicitud.viaticos.find((v) => v.tipoDestino === 'INSTITUCIONAL')
        ?.solicitudPresupuestoId ?? null
    );
  }

  private async registrarHistorial(
    tx: Prisma.TransactionClient,
    data: {
      accion: TipoAccionHistorial;
      usuarioId: number;
      liquidacionViaticosId: number;
      comentario?: string;
    },
  ) {
    await tx.historialAprobacion.create({
      data: {
        accion: data.accion,
        comentario: data.comentario ?? null,
        usuarioId: data.usuarioId,
        liquidacionViaticosId: data.liquidacionViaticosId,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Precarga y alta
  // -------------------------------------------------------------------------

  /**
   * Solicitudes que el usuario puede liquidar, con una hoja por persona del
   * personal institucional del viaje, ya calculada con las tarifas vigentes.
   */
  async solicitudesDisponibles(usuarioId: number) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        deletedAt: null,
        tipo: TipoSolicitud.VIAJE,
        usuarioEmisorId: usuarioId,
        estado: { in: ESTADOS_SOLICITUD_INFORMABLE },
        OR: [
          { liquidacionViaticos: null },
          { liquidacionViaticos: { deletedAt: { not: null } } },
        ],
      },
      include: SOLICITUD_PARA_LIQUIDAR,
      orderBy: { fechaSolicitud: 'desc' },
    });

    const tarifas = await this.tarifasVigentes();
    const personasIds = new Set<number>();
    const filasPorSolicitud = solicitudes.map((s) => {
      const filas = precargarFilasPorPersona(
        s.viaticos.map((v) => ({ ...v, dias: v.dias })),
      );
      filas.forEach((_, id) => personasIds.add(id));
      return filas;
    });
    const personas = new Map(
      (
        await this.prisma.usuario.findMany({
          where: { id: { in: [...personasIds] } },
          select: { id: true, nombreCompleto: true, cargo: true, ci: true },
        })
      ).map((u) => [u.id, u]),
    );

    return solicitudes.map((s, i) => {
      const motivo = s.planViaje?.objetivoViaje || s.motivoViaje || '';
      const destino = s.planViaje?.lugaresViaje || s.lugarViaje || '';
      const hojas = [...filasPorSolicitud[i]].map(([usuarioId, filas]) => {
        const calculadas = filas.map((f) => {
          const tarifa =
            tarifas.get(f.conceptoId)?.tarifa ?? new Prisma.Decimal(0);
          return {
            ...f,
            tarifaLiquida: tarifa,
            ...calcularFila(tarifa, f.dias, f.porcentaje),
          };
        });
        const persona = personas.get(usuarioId);
        return {
          usuario: persona ?? {
            id: usuarioId,
            nombreCompleto: '',
            cargo: '',
            ci: '',
          },
          cargo: persona?.cargo ?? '',
          ci: persona?.ci ?? '',
          sede: 'La Paz',
          via: '',
          escala: escalaPredominante(
            filas.map((f) => ({
              nombreConcepto: f.nombreConcepto,
              dias: f.dias,
            })),
          ),
          motivoViaje: motivo,
          destino,
          fechaSalida: s.fechaInicio,
          fechaRetorno: s.fechaFin,
          filas: calculadas,
          ...totalizarHoja(calculadas),
        };
      });

      // Lo presupuestado para el personal institucional, para advertir excesos
      const presupuestadoLiquido = s.viaticos
        .filter((v) => v.tipoDestino === 'INSTITUCIONAL')
        .reduce((t, v) => t.add(v.montoNeto), new Prisma.Decimal(0));

      return {
        id: s.id,
        codigoSolicitud: s.codigoSolicitud,
        estado: s.estado,
        directorProgramaId: this.directorPropuesto(s),
        partidaPorDefecto: this.partidaDeViaticos(s),
        presupuestadoLiquido,
        hojas,
      };
    });
  }

  async create(dto: CreateLiquidacionViaticosDto, usuarioId: number) {
    const solicitud = await this.obtenerSolicitud(dto.solicitudId, usuarioId);
    if (dto.directorProgramaId !== undefined) {
      await this.validarRevisor(dto.directorProgramaId, usuarioId);
    }
    const directorProgramaId =
      dto.directorProgramaId ?? this.directorPropuesto(solicitud);
    const hojas = await this.calcularHojas(
      dto.hojas,
      solicitud.id,
      this.partidaDeViaticos(solicitud),
    );

    return this.prisma.$transaction(async (tx) => {
      // Una liquidación eliminada conserva la solicitud hasta que otra la toma
      await tx.liquidacionViaticos.updateMany({
        where: { solicitudId: solicitud.id, deletedAt: { not: null } },
        data: { solicitudId: null },
      });

      const codigoLiquidacion = await this.generarCodigo(tx);
      const liquidacion = await tx.liquidacionViaticos.create({
        data: {
          codigoLiquidacion,
          lugarEmision: dto.lugarEmision?.trim() || 'La Paz',
          fechaEmision: dto.fechaEmision,
          usuarioId,
          directorProgramaId,
          solicitudId: solicitud.id,
        },
      });
      for (const [orden, h] of hojas.entries()) {
        await tx.hojaLiquidacion.create({
          data: { ...this.datosHoja(h, orden), liquidacionId: liquidacion.id },
        });
      }
      await this.registrarHistorial(tx, {
        accion: TipoAccionHistorial.CREADO,
        usuarioId,
        liquidacionViaticosId: liquidacion.id,
      });

      this.logger.log(
        `[create] usuarioId=${usuarioId} | codigo=${codigoLiquidacion} | hojas=${hojas.length}`,
      );
      return tx.liquidacionViaticos.findUniqueOrThrow({
        where: { id: liquidacion.id },
        include: LIQUIDACION_INCLUDE,
      });
    });
  }

  // -------------------------------------------------------------------------
  // Consulta
  // -------------------------------------------------------------------------

  async findAll(user: UsuarioContexto) {
    const where: Prisma.LiquidacionViaticosWhereInput = { deletedAt: null };
    if (!this.esVistaGlobal(user.rol)) {
      where.OR = [{ usuarioId: user.id }, { directorProgramaId: user.id }];
    }
    return this.prisma.liquidacionViaticos.findMany({
      where,
      include: LIQUIDACION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendientes(user: UsuarioContexto) {
    return this.prisma.liquidacionViaticos.findMany({
      where: {
        deletedAt: null,
        estado: EstadoLiquidacionViaticos.ENVIADO,
        ...(user.rol === Rol.ADMIN ? {} : { directorProgramaId: user.id }),
      },
      include: LIQUIDACION_INCLUDE,
      orderBy: { updatedAt: 'asc' },
    });
  }

  private puedeVer(l: LiquidacionCompleta, user: UsuarioContexto) {
    if (this.esVistaGlobal(user.rol)) return true;
    if (l.usuarioId === user.id || l.directorProgramaId === user.id) {
      return true;
    }
    // Cada beneficiario ve la liquidación donde tiene hoja
    if (l.hojas.some((h) => h.usuarioId === user.id)) return true;
    const solicitud = activa(l.solicitud);
    if (!solicitud) return false;
    return user.rol !== Rol.USUARIO || solicitud.aprobadorId === user.id;
  }

  async findOne(id: number, user?: UsuarioContexto) {
    const liquidacion = await this.prisma.liquidacionViaticos.findFirst({
      where: { id, deletedAt: null },
      include: LIQUIDACION_INCLUDE,
    });
    if (!liquidacion) {
      throw new NotFoundException(
        `Liquidación de viáticos ${id} no encontrada`,
      );
    }
    if (user && !this.puedeVer(liquidacion, user)) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a esta liquidación de viáticos',
      );
    }
    return liquidacion;
  }

  private async findPropia(id: number, usuarioId: number) {
    const liquidacion = await this.findOne(id);
    if (liquidacion.usuarioId !== usuarioId) {
      throw new ForbiddenException(
        'Solo el autor puede modificar esta liquidación',
      );
    }
    return liquidacion;
  }

  // -------------------------------------------------------------------------
  // Edición y ciclo
  // -------------------------------------------------------------------------

  async update(
    id: number,
    dto: UpdateLiquidacionViaticosDto,
    usuarioId: number,
  ) {
    const liquidacion = await this.findPropia(id, usuarioId);
    if (!ESTADOS_EDITABLES.includes(liquidacion.estado)) {
      throw new BadRequestException(
        liquidacion.estado === EstadoLiquidacionViaticos.ENVIADO
          ? 'La liquidación está esperando la revisión del Director de Programa y no se puede editar'
          : 'La liquidación ya fue revisada y no se puede editar',
      );
    }
    if (dto.directorProgramaId !== undefined) {
      await this.validarRevisor(dto.directorProgramaId, usuarioId);
    }

    let hojas: HojaCalculada[] | null = null;
    if (dto.hojas && liquidacion.solicitudId) {
      const partidaPorDefecto =
        (
          await this.prisma.viatico.findFirst({
            where: {
              solicitudId: liquidacion.solicitudId,
              tipoDestino: 'INSTITUCIONAL',
            },
            select: { solicitudPresupuestoId: true },
          })
        )?.solicitudPresupuestoId ?? null;
      hojas = await this.calcularHojas(
        dto.hojas,
        liquidacion.solicitudId,
        partidaPorDefecto,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Las hojas se reemplazan enteras; aún no hay gastos importados porque
      // solo se importa una liquidación revisada, que ya no es editable.
      if (hojas) {
        await tx.hojaLiquidacion.deleteMany({ where: { liquidacionId: id } });
        for (const [orden, h] of hojas.entries()) {
          await tx.hojaLiquidacion.create({
            data: { ...this.datosHoja(h, orden), liquidacionId: id },
          });
        }
      }
      return tx.liquidacionViaticos.update({
        where: { id },
        data: {
          lugarEmision: dto.lugarEmision?.trim() || liquidacion.lugarEmision,
          fechaEmision: dto.fechaEmision ?? liquidacion.fechaEmision,
          ...(dto.directorProgramaId !== undefined
            ? { directorProgramaId: dto.directorProgramaId }
            : {}),
        },
        include: LIQUIDACION_INCLUDE,
      });
    });
  }

  async enviar(id: number, usuarioId: number) {
    const liquidacion = await this.findPropia(id, usuarioId);
    if (!ESTADOS_EDITABLES.includes(liquidacion.estado)) {
      throw new BadRequestException(
        `Solo se envía una liquidación en borrador u observada (estado actual: ${liquidacion.estado})`,
      );
    }
    if (!liquidacion.directorProgramaId) {
      throw new BadRequestException(
        'Selecciona al Director de Programa que revisará la liquidación',
      );
    }
    if (liquidacion.hojas.length === 0) {
      throw new BadRequestException('La liquidación no tiene personas');
    }

    const reenvio = liquidacion.estado === EstadoLiquidacionViaticos.OBSERVADO;
    await this.prisma.$transaction(async (tx) => {
      await tx.liquidacionViaticos.update({
        where: { id },
        data: { estado: EstadoLiquidacionViaticos.ENVIADO },
      });
      await this.registrarHistorial(tx, {
        accion: reenvio
          ? TipoAccionHistorial.CORREGIDO
          : TipoAccionHistorial.ENVIADO,
        usuarioId,
        liquidacionViaticosId: id,
      });
    });

    await this.notificaciones.crearNotificacion({
      titulo: 'Liquidación de viáticos por revisar',
      mensaje: `${liquidacion.usuario.nombreCompleto} ${reenvio ? 'corrigió y reenvió' : 'envió'} la liquidación ${liquidacion.codigoLiquidacion} para tu revisión`,
      tipo: 'LIQUIDACION_VIATICOS_PENDIENTE',
      usuarioId: liquidacion.directorProgramaId,
      liquidacionViaticosId: id,
      urlDestino: `/app/liquidaciones-viaticos/${id}`,
    });
    return this.findOne(id);
  }

  private async findParaRevision(id: number, user: UsuarioContexto) {
    const liquidacion = await this.findOne(id);
    if (liquidacion.directorProgramaId !== user.id && user.rol !== Rol.ADMIN) {
      throw new ForbiddenException(
        'Solo el Director de Programa asignado puede revisar esta liquidación',
      );
    }
    if (liquidacion.estado !== EstadoLiquidacionViaticos.ENVIADO) {
      throw new BadRequestException(
        `La liquidación no está esperando revisión (estado actual: ${liquidacion.estado})`,
      );
    }
    return liquidacion;
  }

  async revisar(id: number, user: UsuarioContexto) {
    const liquidacion = await this.findParaRevision(id, user);
    await this.prisma.$transaction(async (tx) => {
      await tx.liquidacionViaticos.update({
        where: { id },
        data: {
          estado: EstadoLiquidacionViaticos.REVISADO,
          observacion: null,
          fechaRevision: new Date(),
        },
      });
      await this.registrarHistorial(tx, {
        accion: TipoAccionHistorial.APROBADO,
        usuarioId: user.id,
        liquidacionViaticosId: id,
      });
    });
    await this.notificaciones.crearNotificacion({
      titulo: 'Liquidación de viáticos revisada',
      mensaje: `Tu liquidación ${liquidacion.codigoLiquidacion} fue revisada. Ya puedes importarla a la rendición`,
      tipo: 'LIQUIDACION_VIATICOS_REVISADA',
      usuarioId: liquidacion.usuarioId,
      liquidacionViaticosId: id,
      urlDestino: `/app/liquidaciones-viaticos/${id}`,
    });
    return this.findOne(id);
  }

  async observar(
    id: number,
    dto: ObservarLiquidacionViaticosDto,
    user: UsuarioContexto,
  ) {
    const liquidacion = await this.findParaRevision(id, user);
    const motivo = dto.motivo.trim();
    await this.prisma.$transaction(async (tx) => {
      await tx.liquidacionViaticos.update({
        where: { id },
        data: {
          estado: EstadoLiquidacionViaticos.OBSERVADO,
          observacion: motivo,
        },
      });
      await this.registrarHistorial(tx, {
        accion: TipoAccionHistorial.OBSERVADO,
        usuarioId: user.id,
        liquidacionViaticosId: id,
        comentario: motivo,
      });
    });
    await this.notificaciones.crearNotificacion({
      titulo: 'Liquidación de viáticos observada',
      mensaje: `Tu liquidación ${liquidacion.codigoLiquidacion} fue observada: ${motivo}`,
      tipo: 'LIQUIDACION_VIATICOS_OBSERVADA',
      usuarioId: liquidacion.usuarioId,
      liquidacionViaticosId: id,
      urlDestino: `/app/liquidaciones-viaticos/${id}`,
    });
    return this.findOne(id);
  }

  async remove(id: number, usuarioId: number) {
    const liquidacion = await this.findPropia(id, usuarioId);
    if (liquidacion.estado === EstadoLiquidacionViaticos.REVISADO) {
      throw new BadRequestException(
        'Una liquidación revisada respalda la rendición y no se puede eliminar',
      );
    }
    await this.prisma.liquidacionViaticos.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { mensaje: 'Liquidación de viáticos eliminada correctamente' };
  }

  // -------------------------------------------------------------------------
  // Documentos
  // -------------------------------------------------------------------------

  private async armarDocumento(
    id: number,
    user: UsuarioContexto,
    hojaId?: number,
  ): Promise<DocumentoPdf> {
    const liquidacion = await this.findOne(id, user);
    if (
      hojaId !== undefined &&
      !liquidacion.hojas.some((h) => h.id === hojaId)
    ) {
      throw new NotFoundException(
        `Hoja ${hojaId} no encontrada en la liquidación`,
      );
    }
    return documentoPdf('anexo5.hbs', construirAnexo5(liquidacion, hojaId));
  }

  async generatePdf(id: number, user: UsuarioContexto, hojaId?: number) {
    return this.pdfService.pdfDe(await this.armarDocumento(id, user, hojaId));
  }

  async getDocumentoHtml(id: number, user: UsuarioContexto, hojaId?: number) {
    return this.pdfService.htmlDe(await this.armarDocumento(id, user, hojaId));
  }

  // -------------------------------------------------------------------------
  // Rendición
  // -------------------------------------------------------------------------

  /**
   * Gastos LV listos para el wizard de la rendición: uno por hoja y partida,
   * solo de una liquidación revisada.
   */
  async gastosLv(solicitudId: number, user: UsuarioContexto) {
    const liquidacion = await this.prisma.liquidacionViaticos.findFirst({
      where: { solicitudId, deletedAt: null },
      include: LIQUIDACION_INCLUDE,
    });
    if (!liquidacion) return { estado: null, gastos: [] };
    if (!this.puedeVer(liquidacion, user)) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a esta liquidación de viáticos',
      );
    }
    if (liquidacion.estado !== EstadoLiquidacionViaticos.REVISADO) {
      return { estado: liquidacion.estado, gastos: [] };
    }

    const gastos = liquidacion.hojas.flatMap((hoja) => {
      const porPartida = new Map<number, typeof hoja.filas>();
      for (const f of hoja.filas) {
        if (f.solicitudPresupuestoId === null) continue;
        porPartida.set(f.solicitudPresupuestoId, [
          ...(porPartida.get(f.solicitudPresupuestoId) ?? []),
          f,
        ]);
      }
      return [...porPartida].map(([partidaId, filas]) => {
        const t = totalizarHoja(filas);
        return {
          hojaLiquidacionId: hoja.id,
          concepto: 'Liquidación de viáticos',
          detalle: `Viáticos de ${hoja.usuario.nombreCompleto}`,
          tipoDocumento: 'LV' as const,
          numeroDocumento: `${liquidacion.codigoLiquidacion}-${hoja.orden + 1}`,
          proveedor: hoja.usuario.nombreCompleto,
          fechaDocumento: liquidacion.fechaEmision,
          partidaId,
          montoBruto: t.totalBruto.toNumber(),
          montoImpuestos: t.rcIva.toNumber(),
          montoNeto: t.totalLiquido.toNumber(),
        };
      });
    });

    return { estado: liquidacion.estado, gastos };
  }
}
