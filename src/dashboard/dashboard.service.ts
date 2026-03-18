import { Injectable } from '@nestjs/common';
import { EstadoSolicitud, Prisma, Rol } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type DashboardMovimiento = {
  id: number;
  codigo: string;
  estado: EstadoSolicitud;
  costoTotal: number;
  createdAt: Date;
};

type DashboardMetricaGerencial = {
  montoTotal: number;
  montoComprometido: number;
  montoEjecutado: number;
};

type DashboardMetricsResponse = {
  solicitudesActivas: number;
  rendicionesPendientes: number;
  montoPorRendir: number;
  ultimosMovimientos: DashboardMovimiento[];
  metricaGerencial: DashboardMetricaGerencial | null;
};

const ESTADOS_SOLICITUDES_ACTIVAS: EstadoSolicitud[] = [
  EstadoSolicitud.PENDIENTE,
  EstadoSolicitud.OBSERVADO,
];

const ESTADOS_COMPROMISO_ACTIVO: EstadoSolicitud[] = [
  // En este dominio no existe EstadoSolicitud.APROBADO explícito.
  // PENDIENTE representa solicitudes activas en espera de flujo administrativo.
  EstadoSolicitud.PENDIENTE,
  EstadoSolicitud.DESEMBOLSADO,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(
    userId: number,
    userRol: string,
  ): Promise<DashboardMetricsResponse> {
    const esGerencial = userRol === Rol.ADMIN || userRol === Rol.TESORERO;

    const [
      solicitudesActivas,
      rendicionesPendientes,
      montoPorRendirRaw,
      ultimosMovimientosRaw,
      metricaGerencial,
    ] = await Promise.all([
      this.prisma.solicitud.count({
        where: {
          usuarioEmisorId: userId,
          deletedAt: null,
          estado: { in: ESTADOS_SOLICITUDES_ACTIVAS },
        },
      }),
      this.prisma.solicitud.count({
        where: {
          usuarioEmisorId: userId,
          deletedAt: null,
          estado: EstadoSolicitud.DESEMBOLSADO,
        },
      }),
      this.prisma.solicitud.aggregate({
        where: {
          usuarioEmisorId: userId,
          deletedAt: null,
          estado: EstadoSolicitud.DESEMBOLSADO,
        },
        _sum: {
          montoTotalNeto: true,
        },
      }),
      this.prisma.solicitud.findMany({
        where: {
          usuarioEmisorId: userId,
          deletedAt: null,
        },
        orderBy: {
          fechaSolicitud: 'desc',
        },
        take: 5,
        select: {
          id: true,
          codigoSolicitud: true,
          estado: true,
          montoTotalNeto: true,
          fechaSolicitud: true,
        },
      }),
      esGerencial ? this.obtenerMetricaGerencial() : Promise.resolve(null),
    ]);

    const ultimosMovimientos: DashboardMovimiento[] = ultimosMovimientosRaw.map(
      (movimiento) => ({
        id: movimiento.id,
        codigo: movimiento.codigoSolicitud,
        estado: movimiento.estado,
        costoTotal: new Prisma.Decimal(movimiento.montoTotalNeto).toNumber(),
        createdAt: movimiento.fechaSolicitud,
      }),
    );

    return {
      solicitudesActivas,
      rendicionesPendientes,
      montoPorRendir: new Prisma.Decimal(
        montoPorRendirRaw._sum.montoTotalNeto ?? 0,
      ).toNumber(),
      ultimosMovimientos,
      metricaGerencial,
    };
  }

  private async obtenerMetricaGerencial(): Promise<DashboardMetricaGerencial> {
    const [totalesPoaRaw, comprometidoRaw] = await Promise.all([
      this.prisma.poa.aggregate({
        where: {
          deletedAt: null,
        },
        _sum: {
          costoTotal: true,
          montoEjecutado: true,
        },
      }),
      this.prisma.solicitudPresupuesto.aggregate({
        where: {
          solicitud: {
            deletedAt: null,
            estado: {
              in: ESTADOS_COMPROMISO_ACTIVO,
            },
          },
        },
        _sum: {
          subtotalPresupuestado: true,
        },
      }),
    ]);

    return {
      montoTotal: new Prisma.Decimal(
        totalesPoaRaw._sum.costoTotal ?? 0,
      ).toNumber(),
      montoComprometido: new Prisma.Decimal(
        comprometidoRaw._sum.subtotalPresupuestado ?? 0,
      ).toNumber(),
      montoEjecutado: new Prisma.Decimal(
        totalesPoaRaw._sum.montoEjecutado ?? 0,
      ).toNumber(),
    };
  }
}
