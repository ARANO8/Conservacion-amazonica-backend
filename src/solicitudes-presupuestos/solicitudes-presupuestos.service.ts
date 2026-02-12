import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SolicitudPresupuestoService {
  constructor(private prisma: PrismaService) {}

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

    let totalSolicitudPresupuestado = new Prisma.Decimal(0);
    let totalSolicitudNeto = new Prisma.Decimal(0);

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

      const subtotalP = sumViaticosPresupuestado.add(sumGastosPresupuestado);
      const subtotalN = sumViaticosNeto.add(sumGastosNeto);

      // 4. Actualizamos el presupuesto
      await client.solicitudPresupuesto.update({
        where: { id: p.id },
        data: {
          subtotalPresupuestado: subtotalP,
          subtotalNeto: subtotalN,
        },
      });

      totalSolicitudPresupuestado = totalSolicitudPresupuestado.add(subtotalP);
      totalSolicitudNeto = totalSolicitudNeto.add(subtotalN);
    }

    // 5. Sincronizar totales en la Solicitud
    await client.solicitud.update({
      where: { id: solicitudId },
      data: {
        montoTotalPresupuestado: totalSolicitudPresupuestado,
        montoTotalNeto: totalSolicitudNeto,
      },
    });
  }
}
