import { EstadoRendicion, Prisma, PrismaClient } from '@prisma/client';

async function recalibrarMontoEjecutado(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const gastosConfirmados = await tx.gastoRendicion.findMany({
      where: {
        partidaId: { not: null },
        rendicion: {
          estado: EstadoRendicion.APROBADO,
          solicitud: {
            deletedAt: null,
          },
        },
      },
      select: {
        partidaId: true,
        montoBruto: true,
      },
    });

    const partidaIds = Array.from(
      new Set(
        gastosConfirmados
          .map((gasto) => gasto.partidaId)
          .filter((partidaId): partidaId is number => partidaId !== null),
      ),
    );

    const partidas = partidaIds.length
      ? await tx.solicitudPresupuesto.findMany({
          where: {
            id: { in: partidaIds },
          },
          select: {
            id: true,
            poaId: true,
          },
        })
      : [];

    const poaByPartidaId = new Map(
      partidas.map((partida) => [partida.id, partida]),
    );
    const montoEjecutadoByPoa = new Map<number, Prisma.Decimal>();

    for (const gasto of gastosConfirmados) {
      if (!gasto.partidaId) continue;

      const partida = poaByPartidaId.get(gasto.partidaId);
      if (!partida) continue;

      const acumulado =
        montoEjecutadoByPoa.get(partida.poaId) ?? new Prisma.Decimal(0);
      montoEjecutadoByPoa.set(partida.poaId, acumulado.plus(gasto.montoBruto));
    }

    await tx.poa.updateMany({
      where: { deletedAt: null },
      data: { montoEjecutado: new Prisma.Decimal(0) },
    });

    for (const [poaId, montoEjecutado] of montoEjecutadoByPoa) {
      await tx.poa.update({
        where: { id: poaId },
        data: { montoEjecutado },
      });
    }
  });
}

async function main() {
  const prisma = new PrismaClient();

  try {
    await recalibrarMontoEjecutado(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
