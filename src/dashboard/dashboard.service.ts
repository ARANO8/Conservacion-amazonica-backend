import { ForbiddenException, Injectable } from '@nestjs/common';
import { EstadoRendicion, EstadoSolicitud, Prisma, Rol } from '@prisma/client';
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

type DashboardTendenciaMensual = {
  name: string;
  total: number;
};

type DashboardDistribucionPartida = {
  name: string;
  value: number;
};

type DashboardAdvancedAnalyticsResponse = {
  tendenciaMensual: DashboardTendenciaMensual[];
  distribucionPartidas: DashboardDistribucionPartida[];
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

const ESTADOS_ANALITICA_SOLICITUD: EstadoSolicitud[] = [
  EstadoSolicitud.EJECUTADO,
  EstadoSolicitud.DESEMBOLSADO,
];

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
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

  async getAdvancedAnalytics(
    userRol: string,
  ): Promise<DashboardAdvancedAnalyticsResponse> {
    const esGerencial = userRol === Rol.ADMIN || userRol === Rol.TESORERO;

    if (!esGerencial) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a la analítica avanzada',
      );
    }

    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    const [solicitudesAnioActual, gastosRendicion] = await Promise.all([
      this.prisma.solicitud.findMany({
        where: {
          deletedAt: null,
          estado: { in: ESTADOS_ANALITICA_SOLICITUD },
          fechaSolicitud: {
            gte: startOfYear,
            lt: endOfYear,
          },
        },
        select: {
          fechaSolicitud: true,
          montoTotalNeto: true,
        },
      }),
      this.prisma.gastoRendicion.findMany({
        where: {
          partidaId: { not: null },
          rendicion: {
            estado: EstadoRendicion.APROBADA,
            solicitud: {
              deletedAt: null,
              estado: { in: ESTADOS_ANALITICA_SOLICITUD },
            },
          },
        },
        select: {
          montoBruto: true,
          partida: {
            select: {
              poa: {
                select: {
                  estructura: {
                    select: {
                      partida: {
                        select: {
                          nombre: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const totalesPorMes = new Map<number, Prisma.Decimal>();
    for (let month = 0; month < 12; month += 1) {
      totalesPorMes.set(month, new Prisma.Decimal(0));
    }

    for (const solicitud of solicitudesAnioActual) {
      const month = solicitud.fechaSolicitud.getMonth();
      const acumuladoMes = totalesPorMes.get(month) ?? new Prisma.Decimal(0);
      const montoSolicitud = new Prisma.Decimal(solicitud.montoTotalNeto ?? 0);
      totalesPorMes.set(month, acumuladoMes.plus(montoSolicitud));
    }

    const tendenciaMensual: DashboardTendenciaMensual[] = MONTH_LABELS.map(
      (name, monthIndex) => ({
        name,
        total: (
          totalesPorMes.get(monthIndex) ?? new Prisma.Decimal(0)
        ).toNumber(),
      }),
    );

    const distribucionMap = new Map<string, Prisma.Decimal>();
    for (const gasto of gastosRendicion) {
      const nombrePartida =
        gasto.partida?.poa?.estructura?.partida?.nombre ?? 'Sin partida';
      const acumulado =
        distribucionMap.get(nombrePartida) ?? new Prisma.Decimal(0);
      distribucionMap.set(nombrePartida, acumulado.plus(gasto.montoBruto));
    }

    const distribucionPartidas: DashboardDistribucionPartida[] = Array.from(
      distribucionMap.entries(),
    )
      .map(([name, total]) => ({
        name,
        value: total.toNumber(),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      tendenciaMensual,
      distribucionPartidas,
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
