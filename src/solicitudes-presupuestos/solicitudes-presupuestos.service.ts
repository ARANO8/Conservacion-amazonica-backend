import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SolicitudPresupuestoService {
  private readonly logger = new Logger(SolicitudPresupuestoService.name);

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

    // 2. Buscamos todos los hospedajes de la solicitud (para agruparlos por POA)
    const hospedajes = await client.hospedaje.findMany({
      where: { solicitudId },
    });

    this.logger.debug('--- DEBUG RECALCULAR TOTALES ---');
    this.logger.debug(`Hospedajes leídos desde TX: ${hospedajes.length}`);
    this.logger.debug(
      `Hospedaje POAs (Tipo): ${hospedajes.map((h) => `${h.poaId} (${typeof h.poaId})`).join(', ')}`,
    );

    let totalSolicitudPresupuestado = new Prisma.Decimal(0);
    let totalSolicitudNeto = new Prisma.Decimal(0);

    for (const p of presupuestos) {
      this.logger.debug(
        `Presupuesto POA (Tipo): ${p.poaId} (${typeof p.poaId})`,
      );
      // 3. Sumamos viaticos
      const sumViaticosPresupuestado = p.viaticos.reduce(
        (acc, v) => acc.add(v.montoPresupuestado),
        new Prisma.Decimal(0),
      );
      const sumViaticosNeto = p.viaticos.reduce(
        (acc, v) => acc.add(v.montoNeto),
        new Prisma.Decimal(0),
      );

      // 4. Sumamos gastos
      const sumGastosPresupuestado = p.gastos.reduce(
        (acc, g) => acc.add(g.montoPresupuestado),
        new Prisma.Decimal(0),
      );
      const sumGastosNeto = p.gastos.reduce(
        (acc, g) => acc.add(g.montoNeto),
        new Prisma.Decimal(0),
      );

      // 5. Filtrar y sumar hospedajes del POA correspondiente
      const hospPoa = hospedajes.filter(
        (h) => Number(h.poaId) === Number(p.poaId),
      );
      const sumHospedajesNeto = hospPoa.reduce(
        (acc, h) => acc.add(new Prisma.Decimal(h.costoTotal)),
        new Prisma.Decimal(0),
      );
      const sumHospedajesPresupuestado = hospPoa.reduce(
        (acc, h) =>
          acc
            .add(new Prisma.Decimal(h.costoTotal))
            .add(new Prisma.Decimal(h.iva))
            .add(new Prisma.Decimal(h.it)),
        new Prisma.Decimal(0),
      );

      const subtotalP = sumViaticosPresupuestado
        .add(sumGastosPresupuestado)
        .add(sumHospedajesPresupuestado);
      const subtotalN = sumViaticosNeto
        .add(sumGastosNeto)
        .add(sumHospedajesNeto);

      // 6. Actualizamos el presupuesto
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

    // 7. Sincronizar totales en la Solicitud
    await client.solicitud.update({
      where: { id: solicitudId },
      data: {
        montoTotalPresupuestado: totalSolicitudPresupuestado,
        montoTotalNeto: totalSolicitudNeto,
      },
    });
  }
}
