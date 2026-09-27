import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoInformeViaje,
  Prisma,
  Rol,
  TipoAccionHistorial,
  TipoSolicitud,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentoPdf, PdfService, documentoPdf } from '../pdf/pdf.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { DESTINATARIO_ANEXOS } from '../common/constants/financial.constants';
import {
  CreateActividadInformeViajeDto,
  CreateInformeViajeDto,
} from './dto/create-informe-viaje.dto';
import { UpdateInformeViajeDto } from './dto/update-informe-viaje.dto';
import { ObservarInformeViajeDto } from './dto/observar-informe-viaje.dto';
import {
  ESTADOS_SOLICITUD_INFORMABLE,
  INFORME_VIAJE_INCLUDE,
  InformeViajeCompleto,
} from './informes-viaje.constants';
import { construirAnexo7 } from './anexo7.builder';

/** ADMIN y EJECUTIVO ven los informes de todos. */
const ROLES_VISTA_GLOBAL: Rol[] = [Rol.ADMIN, Rol.EJECUTIVO];

/** Estados en los que el autor edita el informe. */
const ESTADOS_EDITABLES: EstadoInformeViaje[] = [
  EstadoInformeViaje.BORRADOR,
  EstadoInformeViaje.OBSERVADO,
];

interface UsuarioContexto {
  id: number;
  rol: Rol;
}

/** Lo que el formulario precarga al elegir la solicitud. */
export interface PrecargaInforme {
  motivoViaje: string;
  lugarViaje: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  directorProgramaId: number | null;
  actividades: {
    fecha: Date;
    lugar: string;
    personaInstitucion: string;
    actividadesRealizadas: string;
  }[];
}

const SOLICITUD_PARA_INFORME = {
  directorPrograma: { select: { id: true, nombreCompleto: true, rol: true } },
  planViaje: {
    select: {
      objetivoViaje: true,
      lugaresViaje: true,
      actividades: {
        orderBy: { orden: 'asc' as const },
        select: {
          fechaInicio: true,
          lugarLlegada: true,
          actividadProgramada: true,
        },
      },
    },
  },
  informeViaje: { select: { id: true, deletedAt: true } },
} satisfies Prisma.SolicitudInclude;

type SolicitudParaInforme = Prisma.SolicitudGetPayload<{
  include: typeof SOLICITUD_PARA_INFORME;
}>;

/**
 * Lo que ya se sabe del viaje: el objetivo y los lugares del plan (o de la
 * solicitud, si es anterior al plan), sus fechas, y una fila por actividad
 * planificada para completar qué se hizo realmente.
 */
export function precargarInforme(
  solicitud: SolicitudParaInforme,
): PrecargaInforme {
  const plan = solicitud.planViaje;
  // Solicitudes anteriores a la regla pueden tener de director a un Tesorero
  // o al propio emisor: entonces no se propone a nadie y el autor elige.
  const director = solicitud.directorPrograma;
  const directorValido =
    director &&
    director.rol !== Rol.TESORERO &&
    director.id !== solicitud.usuarioEmisorId;
  return {
    motivoViaje: plan?.objetivoViaje || solicitud.motivoViaje || '',
    lugarViaje: plan?.lugaresViaje || solicitud.lugarViaje || '',
    fechaInicio: solicitud.fechaInicio,
    fechaFin: solicitud.fechaFin,
    directorProgramaId: directorValido ? director.id : null,
    actividades: (plan?.actividades ?? []).map((a) => ({
      fecha: a.fechaInicio,
      lugar: a.lugarLlegada ?? '',
      personaInstitucion: '',
      actividadesRealizadas: a.actividadProgramada,
    })),
  };
}

/** El informe activo de una solicitud (uno eliminado no cuenta). */
function informeActivo<S extends { deletedAt: Date | null }>(
  informe: S | null,
): S | null {
  return informe && !informe.deletedAt ? informe : null;
}

@Injectable()
export class InformesViajeService {
  private readonly logger = new Logger(InformesViajeService.name);

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
    const count = await tx.informeViaje.count({
      where: {
        createdAt: {
          gte: new Date(`${anioActual}-01-01`),
          lte: new Date(`${anioActual}-12-31T23:59:59.999Z`),
        },
      },
    });
    const correlativo = (count + 1).toString().padStart(3, '0');
    return `IV-${anioActual}-${correlativo}`;
  }

  /** Las fechas del informe abarcan todas sus filas. */
  private rango(actividades: CreateActividadInformeViajeDto[]) {
    const tiempos = actividades.map((a) => new Date(a.fecha).getTime());
    return {
      fechaInicio: new Date(Math.min(...tiempos)),
      fechaFin: new Date(Math.max(...tiempos)),
    };
  }

  private filas(actividades: CreateActividadInformeViajeDto[]) {
    return actividades.map((a, orden) => ({
      orden,
      fecha: a.fecha,
      lugar: a.lugar.trim(),
      personaInstitucion: a.personaInstitucion.trim(),
      actividadesRealizadas: a.actividadesRealizadas.trim(),
    }));
  }

  /** Mismas reglas que el Director de Programa de la solicitud. */
  private async validarRevisor(
    directorProgramaId: number | null | undefined,
    autorId: number,
  ): Promise<void> {
    if (directorProgramaId == null) return;
    if (directorProgramaId === autorId) {
      throw new BadRequestException(
        'El revisor no puede ser el mismo autor del informe',
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
        'Dirección Financiera no puede revisar el informe como Director de Programa',
      );
    }
  }

  private async registrarHistorial(
    tx: Prisma.TransactionClient,
    data: {
      accion: TipoAccionHistorial;
      usuarioId: number;
      informeViajeId: number;
      comentario?: string;
    },
  ): Promise<void> {
    await tx.historialAprobacion.create({
      data: {
        accion: data.accion,
        comentario: data.comentario ?? null,
        usuarioId: data.usuarioId,
        informeViajeId: data.informeViajeId,
      },
    });
  }

  /**
   * La solicitud de la que se informa: de viaje, del autor, desembolsada y
   * sin otro informe activo.
   */
  private async obtenerSolicitud(
    solicitudId: number,
    autorId: number,
  ): Promise<SolicitudParaInforme> {
    const solicitud = await this.prisma.solicitud.findFirst({
      where: { id: solicitudId, deletedAt: null },
      include: SOLICITUD_PARA_INFORME,
    });

    if (!solicitud) {
      throw new BadRequestException(`Solicitud ${solicitudId} no encontrada`);
    }
    if (solicitud.tipo !== TipoSolicitud.VIAJE) {
      throw new BadRequestException(
        'El informe de viaje solo aplica a solicitudes de viaje',
      );
    }
    if (solicitud.usuarioEmisorId !== autorId) {
      throw new ForbiddenException(
        'Solo puedes informar de tus propias solicitudes de viaje',
      );
    }
    if (!ESTADOS_SOLICITUD_INFORMABLE.includes(solicitud.estado)) {
      throw new BadRequestException(
        'La solicitud aún no fue desembolsada: el informe se hace después del viaje',
      );
    }
    if (informeActivo(solicitud.informeViaje)) {
      throw new BadRequestException(
        `La solicitud ${solicitud.codigoSolicitud} ya tiene su informe de viaje`,
      );
    }
    return solicitud;
  }

  /** Solicitudes de las que el usuario puede informar, con su precarga. */
  async solicitudesDisponibles(usuarioId: number) {
    const solicitudes = await this.prisma.solicitud.findMany({
      where: {
        deletedAt: null,
        tipo: TipoSolicitud.VIAJE,
        usuarioEmisorId: usuarioId,
        estado: { in: ESTADOS_SOLICITUD_INFORMABLE },
        OR: [
          { informeViaje: null },
          { informeViaje: { deletedAt: { not: null } } },
        ],
      },
      include: SOLICITUD_PARA_INFORME,
      orderBy: { fechaSolicitud: 'desc' },
    });

    return solicitudes.map((s) => ({
      id: s.id,
      codigoSolicitud: s.codigoSolicitud,
      estado: s.estado,
      directorPrograma: s.directorPrograma,
      precarga: precargarInforme(s),
    }));
  }

  async create(dto: CreateInformeViajeDto, usuarioId: number) {
    const solicitud = await this.obtenerSolicitud(dto.solicitudId, usuarioId);
    // El revisor elegido se valida; el propuesto ya viene filtrado
    const directorProgramaId =
      dto.directorProgramaId ?? precargarInforme(solicitud).directorProgramaId;
    if (dto.directorProgramaId !== undefined) {
      await this.validarRevisor(dto.directorProgramaId, usuarioId);
    }

    return this.prisma.$transaction(async (tx) => {
      // Un informe eliminado conserva la solicitud hasta que otro la toma
      await tx.informeViaje.updateMany({
        where: { solicitudId: solicitud.id, deletedAt: { not: null } },
        data: { solicitudId: null },
      });

      const codigoInforme = await this.generarCodigo(tx);
      const informe = await tx.informeViaje.create({
        data: {
          codigoInforme,
          motivoViaje: dto.motivoViaje.trim(),
          lugarViaje: dto.lugarViaje.trim(),
          ...this.rango(dto.actividades),
          lugarEmision: dto.lugarEmision?.trim() || 'La Paz',
          fechaEmision: dto.fechaEmision,
          usuarioId,
          directorProgramaId,
          solicitudId: solicitud.id,
          actividades: { create: this.filas(dto.actividades) },
        },
      });

      await this.registrarHistorial(tx, {
        accion: TipoAccionHistorial.CREADO,
        usuarioId,
        informeViajeId: informe.id,
      });

      this.logger.log(
        `[create] usuarioId=${usuarioId} | codigo=${codigoInforme} | solicitud=${solicitud.codigoSolicitud}`,
      );

      return tx.informeViaje.findUniqueOrThrow({
        where: { id: informe.id },
        include: INFORME_VIAJE_INCLUDE,
      });
    });
  }

  async findAll(user: UsuarioContexto) {
    const where: Prisma.InformeViajeWhereInput = { deletedAt: null };
    if (!this.esVistaGlobal(user.rol)) {
      where.OR = [{ usuarioId: user.id }, { directorProgramaId: user.id }];
    }
    return this.prisma.informeViaje.findMany({
      where,
      include: INFORME_VIAJE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Bandeja de revisión: informes enviados a mí. ADMIN ve todos. */
  async findPendientes(user: UsuarioContexto) {
    return this.prisma.informeViaje.findMany({
      where: {
        deletedAt: null,
        estado: EstadoInformeViaje.ENVIADO,
        ...(user.rol === Rol.ADMIN ? {} : { directorProgramaId: user.id }),
      },
      include: INFORME_VIAJE_INCLUDE,
      orderBy: { updatedAt: 'asc' },
    });
  }

  /**
   * Lo ven su autor, su revisor, ADMIN/EJECUTIVO y quien pueda ver la
   * solicitud (los roles distintos de USUARIO, o su aprobador asignado).
   */
  private puedeVer(informe: InformeViajeCompleto, user: UsuarioContexto) {
    if (this.esVistaGlobal(user.rol)) return true;
    if (informe.usuarioId === user.id) return true;
    if (informe.directorProgramaId === user.id) return true;
    const solicitud = informe.solicitud;
    if (!solicitud || solicitud.deletedAt) return false;
    return user.rol !== Rol.USUARIO || solicitud.aprobadorId === user.id;
  }

  async findOne(
    id: number,
    user?: UsuarioContexto,
  ): Promise<InformeViajeCompleto> {
    const informe = await this.prisma.informeViaje.findFirst({
      where: { id, deletedAt: null },
      include: INFORME_VIAJE_INCLUDE,
    });
    if (!informe) {
      throw new NotFoundException(`Informe de viaje ${id} no encontrado`);
    }
    if (user && !this.puedeVer(informe, user)) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a este informe de viaje',
      );
    }
    return informe;
  }

  private async findPropio(id: number, usuarioId: number) {
    const informe = await this.findOne(id);
    if (informe.usuarioId !== usuarioId) {
      throw new ForbiddenException(
        'Solo el autor puede modificar este informe de viaje',
      );
    }
    return informe;
  }

  async update(id: number, dto: UpdateInformeViajeDto, usuarioId: number) {
    const informe = await this.findPropio(id, usuarioId);

    if (!ESTADOS_EDITABLES.includes(informe.estado)) {
      throw new BadRequestException(
        informe.estado === EstadoInformeViaje.ENVIADO
          ? 'El informe está esperando la revisión del Director de Programa y no se puede editar'
          : 'El informe ya fue revisado y no se puede editar',
      );
    }
    if (dto.directorProgramaId !== undefined) {
      await this.validarRevisor(dto.directorProgramaId, usuarioId);
    }

    return this.prisma.$transaction(async (tx) => {
      // La tabla se reemplaza entera: el formulario manda la lista completa
      if (dto.actividades) {
        await tx.actividadInformeViaje.deleteMany({ where: { informeId: id } });
      }

      return tx.informeViaje.update({
        where: { id },
        data: {
          motivoViaje: dto.motivoViaje?.trim() ?? informe.motivoViaje,
          lugarViaje: dto.lugarViaje?.trim() ?? informe.lugarViaje,
          lugarEmision: dto.lugarEmision?.trim() || informe.lugarEmision,
          fechaEmision: dto.fechaEmision ?? informe.fechaEmision,
          ...(dto.directorProgramaId !== undefined
            ? { directorProgramaId: dto.directorProgramaId }
            : {}),
          ...(dto.actividades
            ? {
                ...this.rango(dto.actividades),
                actividades: { create: this.filas(dto.actividades) },
              }
            : {}),
        },
        include: INFORME_VIAJE_INCLUDE,
      });
    });
  }

  async enviar(id: number, usuarioId: number) {
    const informe = await this.findPropio(id, usuarioId);

    if (!ESTADOS_EDITABLES.includes(informe.estado)) {
      throw new BadRequestException(
        `Solo se envía un informe en borrador u observado (estado actual: ${informe.estado})`,
      );
    }
    if (!informe.directorProgramaId) {
      throw new BadRequestException(
        'Selecciona al Director de Programa que revisará el informe',
      );
    }
    if (informe.actividades.length === 0) {
      throw new BadRequestException(
        'Registra al menos una actividad antes de enviar el informe',
      );
    }

    const reenvio = informe.estado === EstadoInformeViaje.OBSERVADO;

    await this.prisma.$transaction(async (tx) => {
      await tx.informeViaje.update({
        where: { id },
        data: { estado: EstadoInformeViaje.ENVIADO },
      });
      await this.registrarHistorial(tx, {
        accion: reenvio
          ? TipoAccionHistorial.CORREGIDO
          : TipoAccionHistorial.ENVIADO,
        usuarioId,
        informeViajeId: id,
      });
    });

    await this.notificaciones.crearNotificacion({
      titulo: 'Informe de viaje por revisar',
      mensaje: `${informe.usuario.nombreCompleto} ${reenvio ? 'corrigió y reenvió' : 'envió'} el informe ${informe.codigoInforme} para tu revisión`,
      tipo: 'INFORME_VIAJE_PENDIENTE',
      usuarioId: informe.directorProgramaId,
      informeViajeId: id,
      urlDestino: `/app/informes-viaje/${id}`,
    });

    this.logger.log(
      `[enviar] informeId=${id} | revisor=${informe.directorProgramaId}`,
    );
    return this.findOne(id);
  }

  /** Solo el revisor asignado (o un ADMIN) revisa u observa. */
  private async findParaRevision(id: number, user: UsuarioContexto) {
    const informe = await this.findOne(id);
    if (informe.directorProgramaId !== user.id && user.rol !== Rol.ADMIN) {
      throw new ForbiddenException(
        'Solo el Director de Programa asignado puede revisar este informe',
      );
    }
    if (informe.estado !== EstadoInformeViaje.ENVIADO) {
      throw new BadRequestException(
        `El informe no está esperando revisión (estado actual: ${informe.estado})`,
      );
    }
    return informe;
  }

  async revisar(id: number, user: UsuarioContexto) {
    const informe = await this.findParaRevision(id, user);

    await this.prisma.$transaction(async (tx) => {
      await tx.informeViaje.update({
        where: { id },
        data: {
          estado: EstadoInformeViaje.REVISADO,
          observacion: null,
          fechaRevision: new Date(),
        },
      });
      await this.registrarHistorial(tx, {
        accion: TipoAccionHistorial.APROBADO,
        usuarioId: user.id,
        informeViajeId: id,
      });
    });

    await this.notificaciones.crearNotificacion({
      titulo: 'Informe de viaje revisado',
      mensaje: `Tu informe ${informe.codigoInforme} fue revisado por el Director de Programa`,
      tipo: 'INFORME_VIAJE_REVISADO',
      usuarioId: informe.usuarioId,
      informeViajeId: id,
      urlDestino: `/app/informes-viaje/${id}`,
    });

    this.logger.log(`[revisar] informeId=${id} | por=${user.id}`);
    return this.findOne(id);
  }

  async observar(
    id: number,
    dto: ObservarInformeViajeDto,
    user: UsuarioContexto,
  ) {
    const informe = await this.findParaRevision(id, user);
    const motivo = dto.motivo.trim();

    await this.prisma.$transaction(async (tx) => {
      await tx.informeViaje.update({
        where: { id },
        data: { estado: EstadoInformeViaje.OBSERVADO, observacion: motivo },
      });
      await this.registrarHistorial(tx, {
        accion: TipoAccionHistorial.OBSERVADO,
        usuarioId: user.id,
        informeViajeId: id,
        comentario: motivo,
      });
    });

    await this.notificaciones.crearNotificacion({
      titulo: 'Informe de viaje observado',
      mensaje: `Tu informe ${informe.codigoInforme} fue observado: ${motivo}`,
      tipo: 'INFORME_VIAJE_OBSERVADO',
      usuarioId: informe.usuarioId,
      informeViajeId: id,
      urlDestino: `/app/informes-viaje/${id}`,
    });

    this.logger.log(`[observar] informeId=${id} | por=${user.id}`);
    return this.findOne(id);
  }

  async remove(id: number, usuarioId: number) {
    const informe = await this.findPropio(id, usuarioId);
    if (informe.estado === EstadoInformeViaje.REVISADO) {
      throw new BadRequestException(
        'Un informe revisado respalda la rendición y no se puede eliminar',
      );
    }

    await this.prisma.informeViaje.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`[remove] informeId=${id} | usuarioId=${usuarioId}`);
    return { mensaje: 'Informe de viaje eliminado correctamente' };
  }

  /** Datos y plantilla del ANEXO 7: de aquí salen el PDF y la vista. */
  private async armarDocumento(
    id: number,
    user: UsuarioContexto,
  ): Promise<DocumentoPdf> {
    const informe = await this.findOne(id, user);
    return documentoPdf(
      'anexo7.hbs',
      construirAnexo7(informe, DESTINATARIO_ANEXOS),
    );
  }

  async generatePdf(id: number, user: UsuarioContexto): Promise<Buffer> {
    return this.pdfService.pdfDe(await this.armarDocumento(id, user));
  }

  async getDocumentoHtml(id: number, user: UsuarioContexto): Promise<string> {
    return this.pdfService.htmlDe(await this.armarDocumento(id, user));
  }
}
