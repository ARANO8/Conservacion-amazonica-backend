import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed independiente e idempotente para el flujo de Compras y Servicios.
 *
 * Crea cotizaciones de ejemplo (con sus líneas) para usuarios ya existentes,
 * cubriendo varios escenarios para pruebas: distintos proveedores, con/sin
 * factura, montos variados y emisores distintos (para validar que un USUARIO
 * solo ve las suyas y que ADMIN/EJECUTIVO ven todas).
 *
 * No toca ninguna otra tabla. Si una cotización (por código) ya existe, la
 * omite, por lo que puede ejecutarse múltiples veces sin duplicar datos.
 *
 * Uso: npx ts-node prisma/seeds/cotizaciones.seed.ts
 */

interface LineaSeed {
  cantidad: number;
  unidad: string;
  detalle: string;
  precioUnitario: number;
}

interface CotizacionSeed {
  codigoCotizacion: string;
  emisorEmail: string;
  proveedorNombre: string;
  proveedorTelefono?: string;
  proveedorDireccion?: string;
  proveedorCorreo?: string;
  garantia?: string;
  disponibilidad?: string;
  duracionCotizacion?: string;
  emiteFactura: boolean;
  observaciones?: string;
  fecha: string;
  lineas: LineaSeed[];
}

const USUARIO_A = 'larteaga@conservacionamazonica.org.bo';
const USUARIO_B = 'dlarrea@conservacionamazonica.org.bo';

const COTIZACIONES: CotizacionSeed[] = [
  {
    codigoCotizacion: 'COT-2026-101',
    emisorEmail: USUARIO_A,
    proveedorNombre: 'Importadora Tecnologica del Sur S.R.L.',
    proveedorTelefono: '+591 2 2451234',
    proveedorDireccion: 'Av. Arce No. 2345, La Paz',
    proveedorCorreo: 'ventas@imptecsur.com.bo',
    garantia: '12 meses',
    disponibilidad: 'Inmediata',
    duracionCotizacion: '30 dias',
    emiteFactura: true,
    observaciones: 'Precios incluyen instalacion y configuracion basica.',
    fecha: '2026-05-05T00:00:00.000Z',
    lineas: [
      {
        cantidad: 3,
        unidad: 'Pza',
        detalle: 'Laptop Dell Latitude 5440 i7 16GB 512GB SSD',
        precioUnitario: 9800,
      },
      {
        cantidad: 2,
        unidad: 'Pza',
        detalle: 'Monitor LED 24" Full HD',
        precioUnitario: 1450,
      },
      {
        cantidad: 5,
        unidad: 'Pza',
        detalle: 'Disco externo SSD 1TB',
        precioUnitario: 850,
      },
    ],
  },
  {
    codigoCotizacion: 'COT-2026-102',
    emisorEmail: USUARIO_A,
    proveedorNombre: 'Libreria y Papeleria La Economica',
    proveedorTelefono: '+591 3 3567890',
    proveedorDireccion: 'Calle Ayacucho No. 120, Santa Cruz',
    proveedorCorreo: 'contacto@laeconomica.bo',
    garantia: 'No aplica',
    disponibilidad: '2 dias habiles',
    duracionCotizacion: '15 dias',
    emiteFactura: true,
    observaciones: 'Entrega en oficina central sin costo adicional.',
    fecha: '2026-05-08T00:00:00.000Z',
    lineas: [
      {
        cantidad: 20,
        unidad: 'Resma',
        detalle: 'Papel bond tamano carta 75g',
        precioUnitario: 38.5,
      },
      {
        cantidad: 12,
        unidad: 'Caja',
        detalle: 'Boligrafos azules x 50 unidades',
        precioUnitario: 45,
      },
      {
        cantidad: 8,
        unidad: 'Pza',
        detalle: 'Archivador de palanca oficio',
        precioUnitario: 22.75,
      },
    ],
  },
  {
    codigoCotizacion: 'COT-2026-103',
    emisorEmail: USUARIO_A,
    proveedorNombre: 'Servicios Logisticos Amazonia',
    proveedorTelefono: '+591 3 8921145',
    proveedorDireccion: 'Puerto Rurrenabaque, Beni',
    proveedorCorreo: 'operaciones@logamazonia.bo',
    garantia: 'No aplica',
    disponibilidad: 'Segun cronograma',
    duracionCotizacion: '45 dias',
    emiteFactura: false,
    observaciones:
      'Servicio de transporte fluvial para equipo de campo, combustible incluido.',
    fecha: '2026-05-10T00:00:00.000Z',
    lineas: [
      {
        cantidad: 4,
        unidad: 'Viaje',
        detalle: 'Transporte fluvial Rurrenabaque - Madidi (ida y vuelta)',
        precioUnitario: 2300,
      },
      {
        cantidad: 6,
        unidad: 'Dia',
        detalle: 'Alquiler de motor fuera de borda 40HP',
        precioUnitario: 480,
      },
    ],
  },
  {
    codigoCotizacion: 'COT-2026-104',
    emisorEmail: USUARIO_A,
    proveedorNombre: 'Ferreteria Industrial Boliviana',
    proveedorTelefono: '+591 2 2778899',
    proveedorDireccion: 'Av. 6 de Agosto No. 980, La Paz',
    proveedorCorreo: 'cotizaciones@feindbol.com',
    garantia: '6 meses en herramientas',
    disponibilidad: 'Inmediata',
    duracionCotizacion: '20 dias',
    emiteFactura: true,
    fecha: '2026-05-12T00:00:00.000Z',
    lineas: [
      {
        cantidad: 10,
        unidad: 'Pza',
        detalle: 'Machete 18" con funda',
        precioUnitario: 65,
      },
      {
        cantidad: 6,
        unidad: 'Pza',
        detalle: 'Carpa impermeable 4 personas',
        precioUnitario: 720,
      },
      {
        cantidad: 15,
        unidad: 'Pza',
        detalle: 'Linterna LED recargable',
        precioUnitario: 95,
      },
      {
        cantidad: 4,
        unidad: 'Rollo',
        detalle: 'Soga de nylon 12mm x 50m',
        precioUnitario: 180,
      },
    ],
  },
  {
    codigoCotizacion: 'COT-2026-105',
    emisorEmail: USUARIO_B,
    proveedorNombre: 'Consultora Ambiental Verde Ltda.',
    proveedorTelefono: '+591 2 2990011',
    proveedorDireccion: 'Calle 21 de Calacoto No. 8400, La Paz',
    proveedorCorreo: 'proyectos@verdeconsultora.bo',
    garantia: 'No aplica',
    disponibilidad: 'A coordinar',
    duracionCotizacion: '60 dias',
    emiteFactura: true,
    observaciones: 'Cotizacion emitida por otro usuario (prueba de propiedad).',
    fecha: '2026-05-14T00:00:00.000Z',
    lineas: [
      {
        cantidad: 1,
        unidad: 'Servicio',
        detalle: 'Estudio de impacto ambiental - fase diagnostico',
        precioUnitario: 28500,
      },
      {
        cantidad: 1,
        unidad: 'Servicio',
        detalle: 'Plan de manejo y monitoreo de biodiversidad',
        precioUnitario: 19750,
      },
    ],
  },
];

function calcularLineas(lineas: LineaSeed[]) {
  const construidas = lineas.map((linea) => {
    const cantidad = new Prisma.Decimal(linea.cantidad);
    const precioUnitario = new Prisma.Decimal(linea.precioUnitario);
    return {
      cantidad,
      unidad: linea.unidad,
      detalle: linea.detalle,
      precioUnitario,
      total: cantidad.times(precioUnitario),
    };
  });

  const total = construidas.reduce(
    (acc, l) => acc.plus(l.total),
    new Prisma.Decimal(0),
  );

  return { construidas, total };
}

async function main() {
  console.log('Iniciando seed de Cotizaciones (Compras y Servicios)...');

  let creadas = 0;
  let omitidas = 0;

  for (const cot of COTIZACIONES) {
    const existente = await prisma.cotizacion.findUnique({
      where: { codigoCotizacion: cot.codigoCotizacion },
    });

    if (existente) {
      omitidas++;
      console.log(`  - ${cot.codigoCotizacion}: ya existe, omitida.`);
      continue;
    }

    const emisor = await prisma.usuario.findUnique({
      where: { email: cot.emisorEmail },
    });

    if (!emisor) {
      console.warn(
        `  ! Emisor no encontrado (${cot.emisorEmail}); se omite ${cot.codigoCotizacion}.`,
      );
      omitidas++;
      continue;
    }

    const { construidas, total } = calcularLineas(cot.lineas);

    await prisma.cotizacion.create({
      data: {
        codigoCotizacion: cot.codigoCotizacion,
        fecha: new Date(cot.fecha),
        proveedorNombre: cot.proveedorNombre,
        proveedorTelefono: cot.proveedorTelefono ?? null,
        proveedorDireccion: cot.proveedorDireccion ?? null,
        proveedorCorreo: cot.proveedorCorreo ?? null,
        garantia: cot.garantia ?? null,
        disponibilidad: cot.disponibilidad ?? null,
        duracionCotizacion: cot.duracionCotizacion ?? null,
        emiteFactura: cot.emiteFactura,
        observaciones: cot.observaciones ?? null,
        total,
        usuarioEmisorId: emisor.id,
        lineas: { create: construidas },
      },
    });

    creadas++;
    console.log(
      `  + ${cot.codigoCotizacion}: creada para ${emisor.email} (Bs ${total.toFixed(2)}).`,
    );
  }

  console.log('--- Resumen Cotizaciones ---');
  console.log(`Creadas: ${creadas}`);
  console.log(`Omitidas (ya existian): ${omitidas}`);
}

main()
  .catch((e) => {
    console.error('Error en seed de cotizaciones:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
