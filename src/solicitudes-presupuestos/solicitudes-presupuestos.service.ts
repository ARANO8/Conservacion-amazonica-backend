import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservarFuenteDto } from './dto/reservar-fuente.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EstadoReserva } from '@prisma/client';

@Injectable()
export class SolicitudPresupuestoService {
  private readonly logger = new Logger(SolicitudPresupuestoService.name);

  constructor(private prisma: PrismaService) {}

  async reservarFuente(dto: ReservarFuenteDto, usuarioId: number) {
    const { poaId } = dto;

    return this.prisma.$transaction(async (tx) => {
      // Buscamos si hay alguna reserva o asignación activa para este POA
      const existing = await tx.solicitudPresupuesto.findFirst({
        where: {
          poaId,
          OR: [
            { estado: EstadoReserva.CONFIRMADO },
            {
              estado: EstadoReserva.RESERVADO,
              expiresAt: { gt: new Date() },
            },
          ],
        },
      });

      if (existing) {
        if (existing.estado === EstadoReserva.CONFIRMADO) {
          throw new ConflictException(
            'Esta partida ya está asignada a otra solicitud aprobada',
          );
        }

        if (
          existing.estado === EstadoReserva.RESERVADO &&
          existing.usuarioId !== usuarioId
        ) {
          throw new ConflictException(
            'Esta partida está siendo seleccionada por otro usuario. Intente en unos minutos',
          );
        }

        // Si es el mismo usuario, renovamos la reserva
        return tx.solicitudPresupuesto.update({
          where: { id: existing.id },
          data: {
            estado: EstadoReserva.RESERVADO,
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            usuarioId,
          },
        });
      }

      // Caso C: No existe o los encontrados estaban expirados (reutilizamos lógica de creación)
      // Nota: Si existía uno expirado, deleteMany lo limpiará el cron,
      // pero para reservar ahora simplemente creamos uno nuevo.
      return tx.solicitudPresupuesto.create({
        data: {
          poaId,
          estado: EstadoReserva.RESERVADO,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          usuarioId,
        },
      });
    });
  }

  async confirmarReservas(solicitudId: number, presupuestosIds: number[]) {
    return this.prisma.solicitudPresupuesto.updateMany({
      where: {
        id: { in: presupuestosIds },
      },
      data: {
        estado: EstadoReserva.CONFIRMADO,
        expiresAt: null,
        solicitudId,
      },
    });
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cronLimpiarReservas() {
    const result = await this.prisma.solicitudPresupuesto.deleteMany({
      where: {
        estado: EstadoReserva.RESERVADO,
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Se liberaron ${result.count} reservas expiradas.`);
    }
  }

  async remove(id: number, usuarioId: number) {
    const reservation = await this.prisma.solicitudPresupuesto.findUnique({
      where: { id },
    });

    if (!reservation) throw new NotFoundException('Reserva no encontrada');
    if (reservation.usuarioId !== usuarioId)
      throw new ConflictException(
        'No tienes permiso para eliminar esta reserva',
      );
    if (reservation.estado === EstadoReserva.CONFIRMADO)
      throw new ConflictException(
        'No se puede eliminar una reserva confirmada por este medio',
      );

    return this.prisma.solicitudPresupuesto.delete({ where: { id } });
  }

  async findMyActive(usuarioId: number) {
    return this.prisma.solicitudPresupuesto.findMany({
      where: {
        usuarioId,
        estado: EstadoReserva.RESERVADO,
        expiresAt: { gt: new Date() },
      },
      include: {
        poa: {
          include: {
            estructura: {
              include: {
                proyecto: true,
                grupo: true,
                partida: true,
              },
            },
            actividad: true,
          },
        },
      },
    });
  }
}
