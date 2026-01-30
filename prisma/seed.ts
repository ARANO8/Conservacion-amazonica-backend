import { PrismaClient, Rol, EstadoPoa } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const prisma = new PrismaClient();

/**
 * Normaliza montos en formato europeo (50.000,00) a decimal estándar (50000.00)
 */
function cleanAmount(val: string): number {
  if (!val) return 0;
  // Eliminar puntos de miles y cambiar coma decimal por punto
  const cleaned = val.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Genera el correo corporativo: [PrimeraLetraNombre][PrimerApellido]@conservacionamazonica.org.bo
 */
function generateEmail(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2)
    return `${fullName.toLowerCase().replace(/\s+/g, '')}@conservacionamazonica.org.bo`;

  const firstName = parts[0];
  // En Bolivia/Latam: [Nombre1] [Nombre2] [Apellido Paterno] [Apellido Materno]
  // MARCOS FERNANDO TERÁN VALENZUELA (4 parts) -> TERÁN is parts[2]
  // MARCOS TERÁN VALENZUELA (3 parts) -> TERÁN is parts[1]
  // MARCOS TERÁN (2 parts) -> TERÁN is parts[1]
  let firstSurname = parts[1]; // Default para 2 y 3 partes
  if (parts.length >= 4) {
    firstSurname = parts[2]; // Para 4 o más partes, asumimos 2 nombres
  }

  const normalize = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
      .replace(/ñ/g, 'n')
      .replace(/Ñ/g, 'N')
      .toLowerCase();

  const email = `${normalize(firstName[0])}${normalize(firstSurname)}@conservacionamazonica.org.bo`;
  return email;
}

/**
 * Parser de CSV robusto para manejar comas dentro de comillas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map((v) => v.replace(/^"|"$/g, '')); // Quitar comillas exteriores
}

async function processCSV(
  filename: string,
  callback: (row: string[]) => Promise<void>,
) {
  const filePath = path.join(__dirname, 'seeds', filename);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Archivo no encontrado: ${filename}`);
    return;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' }); // Latin1 suele ser mejor para estos CSVs con eñes
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.trim()) {
      const row = parseCSVLine(line);
      await callback(row);
    }
  }
}

async function main() {
  const STICKY_PLACEHOLDER = 'SIN_CLASIFICAR_REQUIERE_REVISION';
  const passwordHash =
    '$2a$12$wbhVNc2q5wLlKnryn3F8SOjhR2YYregnGlRB.R2VmhNNhnrhMpYBe';

  // Mapas para caché en memoria
  const proyectoMap = new Map<string, number>();
  const grupoMap = new Map<string, number>();
  const partidaMap = new Map<string, number>();
  const actividadMap = new Map<string, number>();
  const codigoPresupMap = new Map<string, number>();
  const estructuraMap = new Map<string, number>();

  console.log('🚀 Iniciando Seeding...');

  // 1. Usuarios
  let userCount = 0;
  await processCSV('Usuario.csv', async (row) => {
    const [nombre, cargo, rolStr] = row;
    const email = generateEmail(nombre);
    const rol = (Rol[rolStr as keyof typeof Rol] || Rol.USUARIO) as Rol;

    await prisma.usuario.upsert({
      where: { email },
      update: { nombreCompleto: nombre, cargo, rol },
      create: {
        email,
        nombreCompleto: nombre,
        cargo,
        rol,
        password: passwordHash,
      },
    });
    userCount++;
  });

  // 2. Catálogos Maestros (Precarga)
  await processCSV('Proyecto.csv', async (row) => {
    const nombre = row[0];
    const p = await prisma.proyecto.create({ data: { nombre } });
    proyectoMap.set(nombre, p.id);
  });

  await processCSV('Grupo.csv', async (row) => {
    const nombre = row[0];
    const g = await prisma.grupo.create({ data: { nombre } });
    grupoMap.set(nombre, g.id);
  });

  await processCSV('Partida.csv', async (row) => {
    const nombre = row[0];
    const p = await prisma.partida.create({ data: { nombre } });
    partidaMap.set(nombre, p.id);
  });

  await processCSV('Actividad.csv', async (row) => {
    const detalle = row[0];
    const a = await prisma.actividad.create({
      data: { detalleDescripcion: detalle },
    });
    actividadMap.set(detalle, a.id);
  });

  await processCSV('Codigo_Presupuestario.csv', async (row) => {
    const codigo = row[0];
    const c = await prisma.codigoPresupuestario.create({
      data: { codigoCompleto: codigo },
    });
    codigoPresupMap.set(codigo, c.id);
  });

  // 2.5 Conceptos (REAL PRODUCTION DATA)
  console.log('💰 Seeding Conceptos (Limpieza y Carga Real)...');
  await prisma.concepto.deleteMany(); // Limpieza previa

  const conceptosProduccion = [
    { nombre: 'CIUDADES_PRINCIPALES', institucional: 229.89, terceros: 119.05 },
    { nombre: 'CIUDADES_INTERMEDIAS', institucional: 155.17, terceros: 83.33 },
    { nombre: 'PUEBLOS', institucional: 137.93, terceros: 137.93 },
    { nombre: 'COMUNIDADES', institucional: 103.45, terceros: 59.52 },
    { nombre: 'EXTERIOR', institucional: 600.0, terceros: 600.0 },
  ];

  for (const c of conceptosProduccion) {
    await prisma.concepto.create({
      data: {
        nombre: c.nombre,
        precioInstitucional: c.institucional,
        precioTerceros: c.terceros,
      },
    });
  }

  // 2.6 Tipos de Gasto (REAL PRODUCTION DATA)
  console.log('📦 Seeding Tipos de Gasto (Limpieza y Carga Real)...');
  await prisma.tipoGasto.deleteMany(); // Limpieza previa

  const tiposGastoProduccion = [
    { nombre: 'Compra', codigo: 'COMPRA' },
    { nombre: 'Alquiler', codigo: 'ALQUILER' },
    { nombre: 'Servicio', codigo: 'SERVICIO' },
    { nombre: 'Peaje', codigo: 'PEAJE' },
    { nombre: 'AutoCompra', codigo: 'AUTO_COMPRA' },
  ];

  for (const tg of tiposGastoProduccion) {
    await prisma.tipoGasto.create({
      data: tg,
    });
  }

  // 3. Estructura Programática (Relaciones Ternarias Maestras)
  await processCSV('ProyectoGrupoPartida.csv', async (row) => {
    const [proy, grup, part] = row;

    // Auto-Healing para catálogos faltantes en el maestro de relaciones
    if (!proyectoMap.has(proy)) {
      const p = await prisma.proyecto.create({ data: { nombre: proy } });
      proyectoMap.set(proy, p.id);
    }
    if (!grupoMap.has(grup)) {
      const g = await prisma.grupo.create({ data: { nombre: grup } });
      grupoMap.set(grup, g.id);
    }
    if (!partidaMap.has(part)) {
      const p = await prisma.partida.create({ data: { nombre: part } });
      partidaMap.set(part, p.id);
    }

    const pId = proyectoMap.get(proy)!;
    const gId = grupoMap.get(grup)!;
    const prId = partidaMap.get(part)!;

    const key = `${proy}|${grup}|${part}`;

    const est = await prisma.estructuraProgramatica.upsert({
      where: {
        proyectoId_grupoId_partidaId: {
          proyectoId: pId,
          grupoId: gId,
          partidaId: prId,
        },
      },
      update: {},
      create: {
        proyectoId: pId,
        grupoId: gId,
        partidaId: prId,
      },
    });
    estructuraMap.set(key, est.id);
  });

  /**
   * Asegurar que un registro de catálogo exista (Auto-Healing).
   */
  async function ensureCatalog(
    map: Map<string, number>,
    name: string | undefined,
    model: { create: (args: { data: any }) => Promise<{ id: number }> },
    field: string,
  ): Promise<number> {
    const val = name || STICKY_PLACEHOLDER;
    const cachedId = map.get(val);
    if (cachedId !== undefined) return cachedId;

    const record = await model.create({
      data: { [field]: val },
    });

    map.set(val, record.id);
    return record.id;
  }

  // 4. Inserción del POA
  let poaCount = 0;
  await processCSV('POA.csv', async (row) => {
    const [
      codPoa,
      proy,
      grup,
      part,
      codPresup,
      actividadDetalle,
      cant,
      costoUnit,
      costoTotal,
    ] = row;

    // Asegurar elementos de la estructura
    const pId = await ensureCatalog(
      proyectoMap,
      proy,
      prisma.proyecto,
      'nombre',
    );
    const gId = await ensureCatalog(grupoMap, grup, prisma.grupo, 'nombre');
    const prId = await ensureCatalog(
      partidaMap,
      part,
      prisma.partida,
      'nombre',
    );

    // Asegurar estructura
    const key = `${proy || STICKY_PLACEHOLDER}|${grup || STICKY_PLACEHOLDER}|${part || STICKY_PLACEHOLDER}`;
    let estId: number;
    if (estructuraMap.has(key)) {
      estId = estructuraMap.get(key)!;
    } else {
      const est = await prisma.estructuraProgramatica.upsert({
        where: {
          proyectoId_grupoId_partidaId: {
            proyectoId: pId,
            grupoId: gId,
            partidaId: prId,
          },
        },
        update: {},
        create: {
          proyectoId: pId,
          grupoId: gId,
          partidaId: prId,
        },
      });
      estId = est.id;
      estructuraMap.set(key, estId);
      console.log(
        `⚠️ Nueva estructura creada dinámicamente: [${proy || '?'}]-[${grup || '?'}]-[${part || '?'}]`,
      );
    }

    // Asegurar Actividad y Código Presupuestario
    const actId = await ensureCatalog(
      actividadMap,
      actividadDetalle,
      prisma.actividad,
      'detalleDescripcion',
    );
    const cpId = await ensureCatalog(
      codigoPresupMap,
      codPresup,
      prisma.codigoPresupuestario,
      'codigoCompleto',
    );

    // Crear POA
    await prisma.poa.create({
      data: {
        codigoPoa: codPoa || STICKY_PLACEHOLDER,
        cantidad: parseInt(cant) || 0,
        costoUnitario: cleanAmount(costoUnit),
        costoTotal: cleanAmount(costoTotal),
        estado: EstadoPoa.ACTIVO,
        estructuraId: estId,
        actividadId: actId,
        codigoPresupuestarioId: cpId,
      },
    });
    poaCount++;
  });

  console.log(`✅ Seeding completado.`);
  console.log(`--- Resumen ---`);
  console.log(`Usuarios: ${userCount}`);
  console.log(`Estructuras: ${estructuraMap.size}`);
  console.log(`Filas POA: ${poaCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
