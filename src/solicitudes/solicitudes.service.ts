import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto';
import { AprobarSolicitudDto } from './dto/aprobar-solicitud.dto';
import { ObservarSolicitudDto } from './dto/observar-solicitud.dto';
import { DesembolsarSolicitudDto } from './dto/desembolsar-solicitud.dto';
import { Rol, EstadoSolicitud, Solicitud, Prisma } from '@prisma/client';

@Injectable()
export class SolicitudesService {
  constructor(private prisma: PrismaService) {}

  private async generarCodigo(): Promise<string> {
    const anioActual = new Date().getFullYear();
    const count = await this.prisma.solicitud.count({
      where: {
        fechaSolicitud: {
          gte: new Date(`${anioActual}-01-01`),
          lte: new Date(`${anioActual}-12-31`),
        },
      },
    });

    const correlativo = (count + 1).toString().padStart(3, '0');
    return `SOL-${anioActual}-${correlativo}`;
  }

  async create(
    createSolicitudDto: CreateSolicitudDto,
    usuarioId: number,
  ): Promise<Solicitud> {
    const {
      poaId,
      montoSolicitado,
      descripcion,
      fechaInicio,
      fechaFin,
      aprobadorId,
    } = createSolicitudDto;

    // VALIDACIÓN 1: Evitar Auto-Aprobación
    if (aprobadorId === usuarioId) {
      throw new BadRequestException(
        'No puedes asignarte a ti mismo como aprobador inicial',
      );
    }

    const poa = await this.prisma.poa.findUnique({
      where: { id: poaId },
    });

    if (!poa) {
      throw new NotFoundException(`POA con ID ${poaId} no encontrado`);
    }

    // VALIDACIÓN: POA 1 a 1 (Un POA solo puede tener una solicitud activa)
    const poaOcupado = await this.prisma.solicitud.findFirst({
      where: { poaId, deletedAt: null },
    });

    if (poaOcupado) {
      throw new BadRequestException(
        'El ítem del POA seleccionado ya está asociado a otra solicitud activa',
      );
    }

    const codigoSolicitud = await this.generarCodigo();

    return this.prisma.solicitud.create({
      data: {
        codigoSolicitud,
        descripcion,
        montoTotal: new Prisma.Decimal(montoSolicitado),
        liquidoPagable: new Prisma.Decimal(montoSolicitado),
        estado: EstadoSolicitud.PENDIENTE,
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
        fechaFin: fechaFin ? new Date(fechaFin) : null,
        usuarioEmisor: { connect: { id: usuarioId } },
        aprobador: { connect: { id: aprobadorId } },
        usuarioBeneficiado: { connect: { id: usuarioId } }, // BENEFICIARIO AUTOMÁTICO
        poa: { connect: { id: poaId } },
      },
      include: {
        usuarioEmisor: true,
        aprobador: true,
        poa: {
          include: {
            actividad: true,
          },
        },
      },
    });
  }

  async findAll(usuario: { id: number; rol: Rol }): Promise<Solicitud[]> {
    const where: Prisma.SolicitudWhereInput = { deletedAt: null };

    if (usuario.rol === Rol.USUARIO) {
      where.OR = [{ usuarioEmisorId: usuario.id }, { aprobadorId: usuario.id }];
    }

    return this.prisma.solicitud.findMany({
      where,
      include: {
        usuarioEmisor: true,
        aprobador: true,
        poa: {
          include: {
            actividad: true,
          },
        },
      },
      orderBy: {
        fechaSolicitud: 'desc',
      },
    });
  }

  async findOne(id: number): Promise<Solicitud> {
    const solicitud = await this.prisma.solicitud.findFirst({
      where: { id, deletedAt: null },
      include: {
        usuarioEmisor: true,
        aprobador: true,
        poa: true,
      },
    });

    if (!solicitud) {
      throw new NotFoundException(`Solicitud con ID ${id} no encontrada`);
    }

    return solicitud;
  }

  async update(
    id: number,
    updateSolicitudDto: UpdateSolicitudDto,
    usuarioId: number,
  ): Promise<Solicitud> {
    const solicitud = await this.findOne(id);

    // REGLA: Solo el creador puede editar
    if (solicitud.usuarioEmisorId !== usuarioId) {
      throw new ForbiddenException(
        'Solo el creador puede editar esta solicitud',
      );
    }

    // REGLA: Solo si está OBSERVADO
    if (solicitud.estado !== EstadoSolicitud.OBSERVADO) {
      throw new BadRequestException(
        'Solo se pueden editar solicitudes en estado OBSERVADO',
      );
    }

    const { montoSolicitado, aprobadorId, poaId, ...rest } = updateSolicitudDto;

    // VALIDACIÓN 2: Mandatory Approver on Subsanación
    if (aprobadorId === undefined) {
      throw new BadRequestException(
        'Debes asignar un aprobador para subsanar la observación',
      );
    }

    // VALIDACIÓN: Evitar Auto-Aprobación en Update
    if (aprobadorId === usuarioId) {
      throw new BadRequestException(
        'No puedes asignarte a ti mismo como aprobador',
      );
    }

    // VALIDACIÓN 3: POA Uniqueness Check (Excluyendo actual)
    if (poaId !== undefined && poaId !== solicitud.poaId) {
      const poaOcupado = await this.prisma.solicitud.findFirst({
        where: {
          poaId,
          id: { not: id },
          deletedAt: null,
        },
      });

      if (poaOcupado) {
        throw new BadRequestException(
          'El ítem del POA seleccionado ya está asociado a otra solicitud activa',
        );
      }
    }

    const data: Prisma.SolicitudUpdateInput = {
      ...rest,
      estado: EstadoSolicitud.PENDIENTE,
      observacion: null, // Limpiamos la observación al relanzar
      aprobador: { connect: { id: aprobadorId } },
    };

    if (montoSolicitado !== undefined) {
      data.montoTotal = new Prisma.Decimal(montoSolicitado);
      data.liquidoPagable = new Prisma.Decimal(montoSolicitado);
    }

    if (poaId !== undefined) {
      data.poa = { connect: { id: poaId } };
    }

    return this.prisma.solicitud.update({
      where: { id },
      data,
    });
  }

  async remove(id: number, usuarioId: number): Promise<Solicitud> {
    const solicitud = await this.findOne(id);

    if (solicitud.usuarioEmisorId !== usuarioId) {
      throw new ForbiddenException(
        'Solo el creador puede eliminar esta solicitud',
      );
    }

    return this.prisma.solicitud.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number): Promise<Solicitud> {
    const solicitud = await this.prisma.solicitud.findUnique({
      where: { id },
    });

    if (!solicitud) {
      throw new NotFoundException(`Solicitud con ID ${id} no encontrada`);
    }

    return this.prisma.solicitud.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async aprobar(
    id: number,
    usuarioId: number,
    aprobarDto: AprobarSolicitudDto,
  ): Promise<Solicitud> {
    const solicitud = await this.findOne(id);

    if (solicitud.aprobadorId !== usuarioId) {
      throw new ForbiddenException(
        'No tienes permiso para derivar esta solicitud, no eres el aprobador asignado',
      );
    }

    if (solicitud.estado !== EstadoSolicitud.PENDIENTE) {
      throw new BadRequestException(
        'La solicitud debe estar en estado PENDIENTE para ser derivada',
      );
    }

    const { nuevoAprobadorId } = aprobarDto;

    // Verificar que el nuevo aprobador existe
    const nuevoAprobador = await this.prisma.usuario.findUnique({
      where: { id: nuevoAprobadorId },
    });

    if (!nuevoAprobador) {
      throw new NotFoundException(
        `El nuevo aprobador con ID ${nuevoAprobadorId} no existe`,
      );
    }

    return this.prisma.solicitud.update({
      where: { id },
      data: { aprobadorId: nuevoAprobadorId },
    });
  }

  async observar(
    id: number,
    usuarioId: number,
    observarDto: ObservarSolicitudDto,
  ): Promise<Solicitud> {
    const solicitud = await this.findOne(id);

    if (solicitud.aprobadorId !== usuarioId) {
      throw new ForbiddenException(
        'No tienes permiso para observar esta solicitud',
      );
    }

    if (solicitud.estado !== EstadoSolicitud.PENDIENTE) {
      throw new BadRequestException(
        'Solo se pueden observar solicitudes en estado PENDIENTE',
      );
    }

    return this.prisma.solicitud.update({
      where: { id },
      data: {
        estado: EstadoSolicitud.OBSERVADO,
        observacion: observarDto.observacion,
        aprobadorId: solicitud.usuarioEmisorId, // Se devuelve al dueño
      },
    });
  }

  async desembolsar(
    id: number,
    usuario: { id: number; rol: Rol },
    desembolsarDto: DesembolsarSolicitudDto,
  ): Promise<Solicitud> {
    if (usuario.rol !== Rol.TESORERO && usuario.rol !== Rol.ADMIN) {
      throw new ForbiddenException(
        'Solo el personal de Tesorería o Administración puede desembolsar',
      );
    }

    const solicitud = await this.findOne(id);

    if (solicitud.estado !== EstadoSolicitud.PENDIENTE) {
      throw new BadRequestException(
        'La solicitud debe estar en estado PENDIENTE para ser desembolsada',
      );
    }

    return this.prisma.solicitud.update({
      where: { id },
      data: {
        estado: EstadoSolicitud.DESEMBOLSADO,
        codigoDesembolso: desembolsarDto.codigoDesembolso,
        aprobadorId: null, // Finalizado
      },
    });
  }
}
