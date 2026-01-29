import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservarFuenteDto } from './dto/reservar-fuente.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EstadoReserva, Prisma } from '@prisma/client';
import { PoaService } from '../poa/poa.service';

@Injectable()
export class SolicitudPresupuestoService {
  private readonly logger = new Logger(SolicitudPresupuestoService.name);

  private readonly RESERVA_INCLUDE = {
    poa: {
      include: {
        actividad: true,
        codigoPresupuestario: true,
        estructura: {
          include: {
            proyecto: true,
            grupo: true,
            partida: true,
          },
        },
      },
    },
  };

  constructor(
    private prisma: PrismaService,
    private poaService: PoaService,
  ) {}

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
          include: this.RESERVA_INCLUDE,
        });
      }

      // MANDATORY: Calculate available balance before allowing reservation
      const poa = await this.poaService.findOne(poaId);
      if (poa.saldoDisponible <= 0) {
        throw new BadRequestException('Partida Agotada');
      }

      // Caso C: No existe o los encontrados estaban expirados (reutilizamos lógica de creación)
      return tx.solicitudPresupuesto.create({
        data: {
          poaId,
          estado: EstadoReserva.RESERVADO,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          usuarioId,
        },
        include: this.RESERVA_INCLUDE,
      });
    });
  }

  async confirmarReservas(
    solicitudId: number,
    presupuestosIds: number[],
    usuarioId: number,
  ) {
    // Validamos primero que todas las reservas pertenezcan al usuario
    const count = await this.prisma.solicitudPresupuesto.count({
      where: {
        id: { in: presupuestosIds },
        usuarioId,
        estado: EstadoReserva.RESERVADO,
      },
    });

    if (count !== presupuestosIds.length) {
      throw new ConflictException(
        'Algunas de las reservas seleccionadas no son válidas o no pertenecen al usuario',
      );
    }

    return this.prisma.solicitudPresupuesto.updateMany({
      where: {
        id: { in: presupuestosIds },
        usuarioId,
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

  async recalcularTotales(solicitudId: number, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;

    // 1. Buscamos todos los presupuestos asociados a esta solicitud
    const presupuestos = await client.solicitudPresupuesto.findMany({
      where: { solicitudId },
      include: {
        viaticos: true,
        gastos: true,
      },
    });

    for (const p of presupuestos) {
      // 2. Sumamos viaticos
      const sumViaticosPresupuestado = p.viaticos.reduce(
        (acc, v) => acc.add(v.montoPresupuestado),
        new Prisma.Decimal(0),
      );
      const sumViaticosNeto = p.viaticos.reduce(
        (acc, v) => acc.add(v.montoNeto),
        new Prisma.Decimal(0),
      );

      // 3. Sumamos gastos
      const sumGastosPresupuestado = p.gastos.reduce(
        (acc, g) => acc.add(g.montoPresupuestado),
        new Prisma.Decimal(0),
      );
      const sumGastosNeto = p.gastos.reduce(
        (acc, g) => acc.add(g.montoNeto),
        new Prisma.Decimal(0),
      );

      // 4. Actualizamos el presupuesto
      await client.solicitudPresupuesto.update({
        where: { id: p.id },
        data: {
          subtotalPresupuestado: sumViaticosPresupuestado.add(
            sumGastosPresupuestado,
          ),
          subtotalNeto: sumViaticosNeto.add(sumGastosNeto),
        },
      });
    }
  }

  async findMyActive(usuarioId: number) {
    return this.prisma.solicitudPresupuesto.findMany({
      where: {
        usuarioId,
        estado: EstadoReserva.RESERVADO,
        expiresAt: { gt: new Date() },
      },
      include: this.RESERVA_INCLUDE,
    });
  }
}
