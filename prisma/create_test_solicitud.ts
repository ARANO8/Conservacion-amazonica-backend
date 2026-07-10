import { PrismaClient, EstadoSolicitud } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emisor = await prisma.usuario.findFirst({
    where: { email: 'larteaga@conservacionamazonica.org.bo' },
  });

  const aprobador = await prisma.usuario.findFirst({
    where: { email: 'walba@conservacionamazonica.org.bo' },
  });

  if (!emisor || !aprobador) {
    console.error('Users not found');
    return;
  }

  // Encontrar un POA activo para imputar el gasto
  const poa = await prisma.poa.findFirst({
    where: { estado: 'ACTIVO' },
  });

  if (!poa) {
    console.error('No active POA found');
    return;
  }

  // Crear la solicitud en estado DESEMBOLSADO
  const solicitud = await prisma.solicitud.create({
    data: {
      codigoSolicitud: `SOL-TEST-${Date.now().toString().slice(-4)}`,
      descripcion: 'Solicitud de fondos para monitoreo de fauna silvestre',
      motivoViaje: 'Monitoreo de tortugas de río',
      lugarViaje: 'Beni, Rurrenabaque',
      montoTotalNeto: 1000,
      montoTotalPresupuestado: 1000,
      estado: EstadoSolicitud.DESEMBOLSADO,
      proyecto: 'Proyecto Beni Biodiversidad',
      usuarioEmisorId: emisor.id,
      aprobadorId: aprobador.id,
      presupuestos: {
        create: {
          poaId: poa.id,
          subtotalNeto: 1000,
          subtotalPresupuestado: 1000,
        },
      },
    },
  });

  console.log(
    `✅ Created test Solicitud: ${solicitud.codigoSolicitud} (ID: ${solicitud.id})`,
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
