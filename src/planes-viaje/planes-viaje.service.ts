import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoPlanViaje,
  EstadoSolicitud,
  Prisma,
  Rol,
  TipoAccionHistorial,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import {
  CreateActividadPlanDto,
  CreatePlanViajeDto,
} from './dto/create-plan-viaje.dto';
import { UpdatePlanViajeDto } from './dto/update-plan-viaje.dto';
import { ObservarPlanViajeDto } from './dto/observar-plan-viaje.dto';
import {
  PLAN_VIAJE_INCLUDE,
  PlanViajeCompleto,
} from './planes-viaje.constants';
import { construirAnexo1 } from './anexo1.builder';

/** ADMIN y EJECUTIVO ven todos los planes; el resto, los propios. */
const ROLES_VISTA_GLOBAL: Rol[] = [Rol.ADMIN, Rol.EJECUTIVO];

/** Estados en los que el responsable edita el plan con libertad. */
const ESTADOS_EDITABLES: EstadoPlanViaje[] = [
  EstadoPlanViaje.BORRADOR,
  EstadoPlanViaje.OBSERVADO,
];

interface UsuarioContexto {
  id: number;
  rol: Rol;
}

export interface FiltrosPlanViaje {
  estado?: EstadoPlanViaje;
  /** Solo los propios, aprobados y libres: los que puede usar una solicitud */
  disponibles?: boolean;
}

/** La solicitud vinculada cuenta mientras no esté eliminada. */
function solicitudActiva<S extends { deletedAt: Date | null }>(plan: {
  solicitud: S | null;
}): S | null {
  return plan.solicitud && !plan.solicitud.deletedAt ? plan.solicitud : null;
}

@Injectable()
export class PlanesViajeService {
  private readonly logger = new Logger(PlanesViajeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  private esVistaGlobal(rol: Rol): boolean {
    return ROLES_VISTA_GLOBAL.includes(rol);
  }

  private async generarCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const anioActual = new Date().getFullYear();
    const count = await tx.planViaje.count({
      where: {
        createdAt: {
          gte: new Date(`${anioActual}-01-01`),
          lte: new Date(`${anioActual}-12-31T23:59:59.999Z`),
        },
      },
    });
    const correlativo = (count + 1).toString().padStart(3, '0');
    return `PV-${anioActual}-${correlativo}`;
  }

  /**
   * Personal institucional sin repetidos, activo y sin exceder lo declarado.
   * La coincidencia exacta con el conteo se exige al enviar (`estricto`): un
   * borrador puede guardarse a medio completar.
   */
  private async validarParticipantes(
    actividades: CreateActividadPlanDto[],
    estricto: boolean,
  ): Promise<void> {
    const todosLosIds = new Set<number>();

    for (const a of actividades) {
      const ids = a.participantesInstitucionalesIds ?? [];

      if (new Set(ids).size !== ids.length) {
        throw new BadRequestException(
          `La actividad "${a.actividadProgramada}" repite personal institucional`,
        );
      }
      if (
        ids.length > a.cantInstitucional ||
        (estricto && ids.length !== a.cantInstitucional)
      ) {
        throw new BadRequestException(
          `La actividad "${a.actividadProgramada}" declara ${a.cantInstitucional} persona(s) institucional(es) pero selecciona ${ids.length}`,
        );
      }
      ids.forEach((id) => todosLosIds.add(id));
    }

    if (todosLosIds.size === 0) return;

    const activos = await this.prisma.usuario.count({
      where: { id: { in: [...todosLosIds] }, deletedAt: null },
    });
    if (activos !== todosLosIds.size) {
      throw new BadRequestException(
        'Uno o más participantes institucionales no existen o están inactivos',
      );
    }
  }

  private validarFechas(actividades: CreateActividadPlanDto[]): void {
    for (const a of actividades) {
      if (new Date(a.fechaFin) < new Date(a.fechaInicio)) {
        throw new BadRequestException(
          `En "${a.actividadProgramada}" la fecha de fin es anterior a la de inicio`,
        );
      }
    }
  }

  private async validarDirector(
    directorProgramaId: number | null | undefined,
    responsableId: number,
  ): Promise<void> {
    if (directorProgramaId == null) return;

    if (directorProgramaId === responsableId) {
      throw new BadRequestException(
        'El Director de Programa no puede ser el mismo responsable del viaje',
      );
    }
    const director = await this.prisma.usuario.findFirst({
      where: { id: directorProgramaId, deletedAt: null },
      select: { id: true, rol: true },
    });
    if (!director) {
      throw new BadRequestException(
        'El Director de Programa seleccionado no existe o está inactivo',
      );
    }
    // Será también quien revise la solicitud: misma regla que allí
    if (director.rol === Rol.TESORERO) {
      throw new BadRequestException(
        'Dirección Financiera aprueba la solicitud: no puede ser designada como Director de Programa',
      );
    }
  }

  private datosActividad(a: CreateActividadPlanDto, orden: number) {
    return {
      actividadProgramada: a.actividadProgramada.trim(),
      fechaInicio: new Date(a.fechaInicio),
      fechaFin: new Date(a.fechaFin),
      diasCalculados: new Prisma.Decimal(a.dias),
      lugarSalida: a.lugarSalida.trim(),
      lugarLlegada: a.lugarLlegada.trim(),
      cantidadPersonasInstitucional: a.cantInstitucional,
      cantidadPersonasTerceros: a.cantTerceros,
      orden,
    };
  }

  private async registrarHistorial(
    tx: Prisma.TransactionClient,
    data: {
      accion: TipoAccionHistorial;
      usuarioId: number;
      planViajeId: number;
      comentario?: string;
    },
  ): Promise<void> {
    await tx.historialAprobacion.create({
      data: {
        accion: data.accion,
        comentario: data.comentario ?? null,
        usuarioId: data.usuarioId,
        planViajeId: data.planViajeId,
      },
    });
  }

  async create(dto: CreatePlanViajeDto, usuarioId: number) {
    const autor = await this.prisma.usuario.findFirst({
      where: { id: usuarioId, deletedAt: null },
      select: { cargo: true },
    });
    if (!autor) {
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);
    }

    this.validarFechas(dto.actividades);
    await this.validarParticipantes(dto.actividades, false);
    await this.validarDirector(dto.directorProgramaId, usuarioId);

    return this.prisma.$transaction(async (tx) => {
      const codigoPlan = await this.generarCodigo(tx);

      const plan = await tx.planViaje.create({
        data: {
          codigoPlan,
          cargo: dto.cargo?.trim() || autor.cargo || '',
          lugaresViaje: dto.lugaresViaje.trim(),
          objetivoViaje: dto.objetivoViaje.trim(),
          lugarEmision: dto.lugarEmision?.trim() || 'La Paz',
          fechaEmision: dto.fechaEmision,
          usuarioId,
          directorProgramaId: dto.directorProgramaId ?? null,
        },
      });

      for (const [orden, a] of dto.actividades.entries()) {
        await tx.planificacion.create({
          data: {
            ...this.datosActividad(a, orden),
            planViajeId: plan.id,
            participantesInstitucionales: {
              connect: a.participantesInstitucionalesIds.map((id) => ({ id })),
            },
          },
        });
      }

      await this.registrarHistorial(tx, {
        accion: TipoAccionHistorial.CREADO,
        usuarioId,
        planViajeId: plan.id,
      });

      this.logger.log(
        `[create] usuarioId=${usuarioId} | codigo=${codigoPlan} | actividades=${dto.actividades.length}`,
      );

      return tx.planViaje.findUniqueOrThrow({
        where: { id: plan.id },
        include: PLAN_VIAJE_INCLUDE,
      });
    });
  }

  async findAll(user: UsuarioContexto, filtros: FiltrosPlanViaje = {}) {
    const where: Prisma.PlanViajeWhereInput = { deletedAt: null };

    if (filtros.disponibles) {
      where.usuarioId = user.id;
      where.estado = EstadoPlanViaje.APROBADO;
      where.OR = [
        { solicitud: null },
        { solicitud: { deletedAt: { not: null } } },
      ];
    } else {
      if (!this.esVistaGlobal(user.rol)) {
        where.OR = [{ usuarioId: user.id }, { directorProgramaId: user.id }];
      }
      if (filtros.estado) where.estado = filtros.estado;
    }

    return this.prisma.planViaje.findMany({
      where,
      include: PLAN_VIAJE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Bandeja de VoBo: planes enviados a mí. ADMIN ve todos los enviados. */
  async findPendientes(user: UsuarioContexto) {
    return this.prisma.planViaje.findMany({
      where: {
        deletedAt: null,
        estado: EstadoPlanViaje.ENVIADO,
        ...(user.rol === Rol.ADMIN ? {} : { directorProgramaId: user.id }),
      },
      include: PLAN_VIAJE_INCLUDE,
      orderBy: { updatedAt: 'asc' },
    });
  }

  /**
   * Ven el plan su responsable, su director, ADMIN/EJECUTIVO y quien pueda ver
   * la solicitud vinculada (mismo criterio que la solicitud: los roles
   * distintos de USUARIO, o el aprobador asignado).
   */
  private puedeVer(plan: PlanViajeCompleto, user: UsuarioContexto): boolean {
    if (this.esVistaGlobal(user.rol)) return true;
    if (plan.usuarioId === user.id) return true;
    if (plan.directorProgramaId === user.id) return true;

    const solicitud = solicitudActiva(plan);
    if (!solicitud) return false;
    return user.rol !== Rol.USUARIO || solicitud.aprobadorId === user.id;
  }

  async findOne(
    id: number,
    user?: UsuarioContexto,
  ): Promise<PlanViajeCompleto> {
    const plan = await this.prisma.planViaje.findFirst({
      where: { id, deletedAt: null },
      include: PLAN_VIAJE_INCLUDE,
    });

    if (!plan) {
      throw new NotFoundException(`Plan de viaje ${id} no encontrado`);
    }
    if (user && !this.puedeVer(plan, user)) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a este plan de viaje',
      );
    }

    return plan;
  }

  private async findPropio(id: number, usuarioId: number) {
    const plan = await this.findOne(id);
    if (plan.usuarioId !== usuarioId) {
      throw new ForbiddenException(
        'Solo el responsable del viaje puede modificar este plan',
      );
    }
    return plan;
  }

  /**
   * Libre en BORRADOR/OBSERVADO. Un plan aprobado solo se corrige cuando la
   * solicitud que alimenta fue observada: la solicitud se revalida al reenviarse.
   */
  private validarEditable(plan: PlanViajeCompleto): void {
    if (ESTADOS_EDITABLES.includes(plan.estado)) return;

    const solicitud = solicitudActiva(plan);
    if (
      plan.estado === EstadoPlanViaje.APROBADO &&
      solicitud?.estado === EstadoSolicitud.OBSERVADO
    ) {
      return;
    }

    throw new BadRequestException(
      plan.estado === EstadoPlanViaje.ENVIADO
        ? 'El plan está esperando el VoBo del Director de Programa y no se puede editar'
        : 'El plan ya fue aprobado; solo se puede corregir si su solicitud está observada',
    );
  }

  async update(id: number, dto: UpdatePlanViajeDto, usuarioId: number) {
    const plan = await this.findPropio(id, usuarioId);
    this.validarEditable(plan);

    const corrigeAprobado = plan.estado === EstadoPlanViaje.APROBADO;

    if (dto.actividades) {
      this.validarFechas(dto.actividades);
      // Un plan aprobado no vuelve a pasar por "enviar": se exige completo ya
      await this.validarParticipantes(dto.actividades, corrigeAprobado);

      const idsDelPlan = new Set(plan.actividades.map((a) => a.id));
      const ajena = dto.actividades.find(
        (a) => a.id !== undefined && !idsDelPlan.has(a.id),
      );
      if (ajena) {
        throw new BadRequestException(
          `La actividad ${ajena.id} no pertenece a este plan`,
        );
      }
    }
    if (dto.directorProgramaId !== undefined) {
      // Una solicitud en curso ya tiene fijado a su director
      if (
        solicitudActiva(plan) &&
        dto.directorProgramaId !== plan.directorProgramaId
      ) {
        throw new BadRequestException(
          'No se puede cambiar el Director de Programa de un plan vinculado a una solicitud',
        );
      }
      await this.validarDirector(dto.directorProgramaId, usuarioId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.actividades) {
        // Upsert por id: las filas que sobreviven conservan sus viáticos y su
        // nómina de terceros. Las que no vuelven se eliminan (y con ellas, en
        // cascada, las personas externas de esa actividad).
        const idsQueVuelven = new Set(
          dto.actividades.map((a) => a.id).filter((x) => x !== undefined),
        );
        const eliminadas = plan.actividades
          .map((a) => a.id)
          .filter((x) => !idsQueVuelven.has(x));
        if (eliminadas.length > 0) {
          await tx.planificacion.deleteMany({
            where: { id: { in: eliminadas }, planViajeId: id },
          });
        }

        for (const [orden, a] of dto.actividades.entries()) {
          const participantes = a.participantesInstitucionalesIds.map(
            (uid) => ({ id: uid }),
          );
          if (a.id !== undefined) {
            await tx.planificacion.update({
              where: { id: a.id },
              data: {
                ...this.datosActividad(a, orden),
                participantesInstitucionales: { set: participantes },
              },
            });
          } else {
            await tx.planificacion.create({
              data: {
                ...this.datosActividad(a, orden),
                planViajeId: id,
                participantesInstitucionales: { connect: participantes },
              },
            });
          }
        }
      }

      await tx.planViaje.update({
        where: { id },
        data: {
          cargo: dto.cargo?.trim() ?? plan.cargo,
          lugaresViaje: dto.lugaresViaje?.trim() ?? plan.lugaresViaje,
          objetivoViaje: dto.objetivoViaje?.trim() ?? plan.objetivoViaje,
          lugarEmision: dto.lugarEmision?.trim() || plan.lugarEmision,
          fechaEmision: dto.fechaEmision ?? plan.fechaEmision,
          ...(dto.directorProgramaId !== undefined
            ? { directorProgramaId: dto.directorProgramaId }
            : {}),
        },
      });

      // Corregir un plan aprobado no pide un nuevo VoBo, pero queda registrado
      if (corrigeAprobado) {
        await this.registrarHistorial(tx, {
          accion: TipoAccionHistorial.CORREGIDO,
          usuarioId,
          planViajeId: id,
          comentario: 'Plan corregido con la solicitud observada',
        });
      }

      return tx.planViaje.findUniqueOrThrow({
        where: { id },
        include: PLAN_VIAJE_INCLUDE,
      });
    });
  }

  async enviar(id: number, usuarioId: number) {
    const plan = await this.findPropio(id, usuarioId);

    if (!ESTADOS_EDITABLES.includes(plan.estado)) {
      throw new BadRequestException(
        `Solo se puede enviar un plan en borrador u observado (estado actual: ${plan.estado})`,
      );
    }
    if (!plan.directorProgramaId) {
      throw new BadRequestException(
        'Selecciona al Director de Programa que dará el VoBo',
      );
    }
    // Recién aquí la nómina institucional debe cuadrar con lo declarado
    for (const a of plan.actividades) {
      const seleccionados = a.participantesInstitucionales.length;
      if (seleccionados !== a.cantidadPersonasInstitucional) {
        throw new BadRequestException(
          `En "${a.actividadProgramada}" declaraste ${a.cantidadPersonasInstitucional} persona(s) institucional(es) pero seleccionaste ${seleccionados}`,
        );
      }
      if (!a.lugarSalida || !a.lugarLlegada) {
        throw new BadRequestException(
          `En "${a.actividadProgramada}" faltan el lugar de salida o el de llegada`,
        );
      }
    }

    const reenvio = plan.estado === EstadoPlanViaje.OBSERVADO;

    await this.prisma.$transaction(async (tx) => {
      await tx.planViaje.update({
        where: { id },
        data: { estado: EstadoPlanViaje.ENVIADO },
      });
      await this.registrarHistorial(tx, {
        accion: reenvio
          ? TipoAccionHistorial.CORREGIDO
          : TipoAccionHistorial.ENVIADO,
        usuarioId,
        planViajeId: id,
      });
    });

    await this.notificaciones.crearNotificacion({
      titulo: 'Plan de viaje para VoBo',
      mensaje: `${plan.usuario.nombreCompleto} ${reenvio ? 'corrigió y reenvió' : 'envió'} el plan ${plan.codigoPlan} para tu VoBo`,
      tipo: 'PLAN_VIAJE_PENDIENTE',
      usuarioId: plan.directorProgramaId,
      planViajeId: id,
      urlDestino: `/app/planes-viaje/${id}`,
    });

    this.logger.log(
      `[enviar] planId=${id} | director=${plan.directorProgramaId}`,
    );
    return this.findOne(id);
  }

  /** Solo el Director de Programa asignado (o un ADMIN) da el VoBo. */
  private async findParaVoBo(id: number, user: UsuarioContexto) {
    const plan = await this.findOne(id);

    if (plan.directorProgramaId !== user.id && user.rol !== Rol.ADMIN) {
      throw new ForbiddenException(
        'Solo el Director de Programa asignado puede dar el VoBo de este plan',
      );
    }
    if (plan.estado !== EstadoPlanViaje.ENVIADO) {
      throw new BadRequestException(
        `El plan no está esperando VoBo (estado actual: ${plan.estado})`,
      );
    }
    return plan;
  }

  async aprobar(id: number, user: UsuarioContexto) {
    const plan = await this.findParaVoBo(id, user);

    await this.prisma.$transaction(async (tx) => {
      await tx.planViaje.update({
        where: { id },
        data: {
          estado: EstadoPlanViaje.APROBADO,
          observacion: null,
          fechaAprobacion: new Date(),
        },
      });
      await this.registrarHistorial(tx, {
        accion: TipoAccionHistorial.APROBADO,
        usuarioId: user.id,
        planViajeId: id,
      });
    });

    await this.notificaciones.crearNotificacion({
      titulo: 'Plan de viaje aprobado',
      mensaje: `Tu plan ${plan.codigoPlan} recibió el VoBo. Ya puedes crear la solicitud de viaje`,
      tipo: 'PLAN_VIAJE_APROBADO',
      usuarioId: plan.usuarioId,
      planViajeId: id,
      urlDestino: `/app/planes-viaje/${id}`,
    });

    this.logger.log(`[aprobar] planId=${id} | por=${user.id}`);
    return this.findOne(id);
  }

  async observar(id: number, dto: ObservarPlanViajeDto, user: UsuarioContexto) {
    const plan = await this.findParaVoBo(id, user);
    const motivo = dto.motivo.trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.planViaje.update({
        where: { id },
        data: { estado: EstadoPlanViaje.OBSERVADO, observacion: motivo },
      });
      await this.registrarHistorial(tx, {
        accion: TipoAccionHistorial.OBSERVADO,
        usuarioId: user.id,
        planViajeId: id,
        comentario: motivo,
      });
    });

    await this.notificaciones.crearNotificacion({
      titulo: 'Plan de viaje observado',
      mensaje: `Tu plan ${plan.codigoPlan} fue observado: ${motivo}`,
      tipo: 'PLAN_VIAJE_OBSERVADO',
      usuarioId: plan.usuarioId,
      planViajeId: id,
      urlDestino: `/app/planes-viaje/${id}`,
    });

    this.logger.log(`[observar] planId=${id} | por=${user.id}`);
    return this.findOne(id);
  }

  async remove(id: number, usuarioId: number) {
    const plan = await this.findPropio(id, usuarioId);

    const solicitud = solicitudActiva(plan);
    if (solicitud) {
      throw new BadRequestException(
        `No se puede eliminar: el plan respalda la solicitud ${solicitud.codigoSolicitud}`,
      );
    }

    await this.prisma.planViaje.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`[remove] planId=${id} | usuarioId=${usuarioId}`);
    return { mensaje: 'Plan de viaje eliminado correctamente' };
  }

  /**
   * Plan con el que nace (o se corrige) una solicitud de viaje: del emisor,
   * aprobado y libre. En la edición se admite la propia solicitud.
   */
  async obtenerParaSolicitud(
    planViajeId: number,
    emisorId: number,
    solicitudId?: number,
  ): Promise<PlanViajeCompleto> {
    const plan = await this.prisma.planViaje.findFirst({
      where: { id: planViajeId, deletedAt: null },
      include: PLAN_VIAJE_INCLUDE,
    });

    if (!plan) {
      throw new BadRequestException(
        `Plan de viaje ${planViajeId} no encontrado`,
      );
    }
    if (plan.usuarioId !== emisorId) {
      throw new ForbiddenException(
        'Solo puedes usar tus propios planes de viaje',
      );
    }
    if (plan.estado !== EstadoPlanViaje.APROBADO) {
      throw new BadRequestException(
        'El plan de viaje aún no tiene el VoBo del Director de Programa',
      );
    }
    const vinculada = solicitudActiva(plan);
    if (vinculada && vinculada.id !== solicitudId) {
      throw new BadRequestException(
        `El plan de viaje ya respalda la solicitud ${vinculada.codigoSolicitud}`,
      );
    }

    return plan;
  }

  private async datosAnexo1(id: number, user: UsuarioContexto) {
    const plan = await this.findOne(id, user);
    return construirAnexo1(plan);
  }

  async getAnexo1Html(id: number, user: UsuarioContexto): Promise<string> {
    return this.pdfService.renderHtml(
      'anexo1.hbs',
      await this.datosAnexo1(id, user),
    );
  }

  async generatePdf(id: number, user: UsuarioContexto): Promise<Buffer> {
    return this.pdfService.generatePdf(
      'anexo1.hbs',
      await this.datosAnexo1(id, user),
    );
  }
}
