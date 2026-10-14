import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoSolicitud,
  Prisma,
  Rol,
  TipoAccionHistorial,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import {
  CreateActividadPlanDto,
  CreatePlanViajeDto,
} from './dto/create-plan-viaje.dto';
import { UpdatePlanViajeDto } from './dto/update-plan-viaje.dto';
import {
  PLAN_VIAJE_INCLUDE,
  PlanViajeCompleto,
} from './planes-viaje.constants';
import { construirAnexo1 } from './anexo1.builder';
import { faltanteDelPlan, planCompleto } from './planes-viaje.helper';

/** ADMIN y EJECUTIVO ven todos los planes; el resto, los propios. */
const ROLES_VISTA_GLOBAL: Rol[] = [Rol.ADMIN, Rol.EJECUTIVO];

interface UsuarioContexto {
  id: number;
  rol: Rol;
}

export interface FiltrosPlanViaje {
  /** Solo los propios, completos y libres: los que puede usar una solicitud */
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
   * La coincidencia exacta con el conteo se exige si el plan ya respalda una
   * solicitud (`estricto`); uno libre puede guardarse a medio completar.
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
      where.OR = [
        { solicitud: null },
        { solicitud: { deletedAt: { not: null } } },
      ];
    } else if (!this.esVistaGlobal(user.rol)) {
      where.usuarioId = user.id;
    }

    const planes = await this.prisma.planViaje.findMany({
      where,
      include: PLAN_VIAJE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    // Prisma no compara el largo de una relación con una columna: lo
    // completo se filtra aquí
    return filtros.disponibles ? planes.filter(planCompleto) : planes;
  }

  /**
   * Ven el plan su responsable, ADMIN/EJECUTIVO y quien pueda ver
   * la solicitud vinculada (mismo criterio que la solicitud: los roles
   * distintos de USUARIO, o el aprobador asignado).
   */
  private puedeVer(plan: PlanViajeCompleto, user: UsuarioContexto): boolean {
    if (this.esVistaGlobal(user.rol)) return true;
    if (plan.usuarioId === user.id) return true;

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
   * Libre mientras no respalde una solicitud. Vinculado, solo se corrige cuando
   * la solicitud fue observada: la solicitud se revalida al reenviarse.
   */
  private validarEditable(plan: PlanViajeCompleto): void {
    const solicitud = solicitudActiva(plan);
    if (!solicitud || solicitud.estado === EstadoSolicitud.OBSERVADO) return;

    throw new BadRequestException(
      `El plan respalda la solicitud ${solicitud.codigoSolicitud}; solo se puede corregir si esa solicitud está observada`,
    );
  }

  async update(id: number, dto: UpdatePlanViajeDto, usuarioId: number) {
    const plan = await this.findPropio(id, usuarioId);
    this.validarEditable(plan);

    const corrigeVinculado = solicitudActiva(plan) !== null;

    if (dto.actividades) {
      this.validarFechas(dto.actividades);
      // Un plan vinculado debe seguir sirviendo a su solicitud: completo ya
      await this.validarParticipantes(dto.actividades, corrigeVinculado);

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
        },
      });

      // Corregir el plan de una solicitud observada queda registrado
      if (corrigeVinculado) {
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
   * completo y libre. En la edición se admite la propia solicitud.
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
    const faltante = faltanteDelPlan(plan);
    if (faltante) {
      throw new BadRequestException(
        `El plan de viaje ${plan.codigoPlan} está incompleto. ${faltante}`,
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
