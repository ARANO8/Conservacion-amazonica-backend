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

/**
 * Mapa de codificación por archivo CSV
 * POA.csv utiliza Latin-1 (ISO-8859-1) porque proviene de fuente externa
 * Los demás archivos utilizan UTF-8
 */
const CSV_ENCODING_MAP: Record<string, BufferEncoding> = {
  'POA.csv': 'latin1',
  'Usuario.csv': 'utf8',
  'Concepto.csv': 'utf8',
  'TipoGasto.csv': 'utf8',
  'cuentasBancarias.csv': 'utf8',
};

async function processCSV(
  filename: string,
  callback: (row: string[]) => Promise<void>,
) {
  const filePath = path.join(__dirname, 'seeds', filename);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Archivo no encontrado: ${filename}`);
    return;
  }

  // Determinar codificación del archivo, por defecto UTF-8
  const encoding = CSV_ENCODING_MAP[filename] || 'utf8';
  const fileStream = fs.createReadStream(filePath, { encoding });
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

  // Mapas para cach en memoria (Cach Agresivo)
  const proyectoMap = new Map<string, number>();
  const grupoMap = new Map<string, number>();
  const partidaMap = new Map<string, number>();
  const actividadMap = new Map<string, number>();
  const codigoPresupMap = new Map<string, number>();
  const estructuraMap = new Map<string, number>();

  console.log('🚀 Iniciando Seeding Optimizado...');

  // 1. Usuarios
  let userCount = 0;
  await processCSV('Usuario.csv', async (row) => {
    const [nombre, email, cargo, rolStr] = row;
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

  // 1.5 Cuentas Bancarias
  console.log('🏦 Seeding Cuentas Bancarias...');
  let cuentaCount = 0;
  await processCSV('cuentasBancarias.csv', async (row) => {
    const [numeroCuenta, banco, moneda] = row;
    if (numeroCuenta === 'numeroCuenta') return; // Skip header
    await prisma.cuentaBancaria.upsert({
      where: { numeroCuenta },
      update: {},
      create: {
        numeroCuenta,
        banco: banco || 'BISA S.A.',
        moneda: moneda || 'M/N',
      },
    });
    cuentaCount++;
  });

  // 2. Conceptos (REAL PRODUCTION DATA)
  console.log('💰 Seeding Conceptos...');
  await processCSV('Concepto.csv', async (row) => {
    const [nombre, institucional, terceros] = row;
    await prisma.concepto.upsert({
      where: { nombre },
      update: {
        precioInstitucional: cleanAmount(institucional),
        precioTerceros: cleanAmount(terceros),
      },
      create: {
        nombre,
        precioInstitucional: cleanAmount(institucional),
        precioTerceros: cleanAmount(terceros),
      },
    });
  });

  // 3. Tipos de Gasto (REAL PRODUCTION DATA)
  console.log('📦 Seeding Tipos de Gasto...');
  await processCSV('TipoGasto.csv', async (row) => {
    const [nombre, codigo] = row;
    await prisma.tipoGasto.upsert({
      where: { codigo },
      update: { nombre },
      create: { nombre, codigo },
    });
  });

  /**
   * Helper: Buscar en Map o crear en BD (Optimizado)
   */
  async function getOrCreate(
    map: Map<string, number>,
    name: string | undefined,
    model: { create: (args: { data: any }) => Promise<{ id: number }> },
    field: string,
  ): Promise<number> {
    const val = (name || STICKY_PLACEHOLDER).trim();
    const cachedId = map.get(val);
    if (cachedId !== undefined) return cachedId;

    const record = await model.create({
      data: { [field]: val },
    });

    map.set(val, record.id);
    return record.id;
  }

  // 4. Inserción del POA (Fuente única de Verdad)
  console.log('📄 Procesando POA.csv (Estructura Dinámica)...');
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

    // A. Asegurar Catlogos (Proyecto, Grupo, Partida)
    const pId = await getOrCreate(proyectoMap, proy, prisma.proyecto, 'nombre');
    const gId = await getOrCreate(grupoMap, grup, prisma.grupo, 'nombre');
    const prId = await getOrCreate(partidaMap, part, prisma.partida, 'nombre');

    // B. Asegurar Estructura Programtica (Relacin Ternaria)
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
    }

    // C. Asegurar Actividad y Cdigo Presupuestario
    const actId = await getOrCreate(
      actividadMap,
      actividadDetalle,
      prisma.actividad,
      'detalleDescripcion',
    );
    const cpId = await getOrCreate(
      codigoPresupMap,
      codPresup,
      prisma.codigoPresupuestario,
      'codigoCompleto',
    );

    // D. Crear POA
    await prisma.poa.create({
      data: {
        codigoPoa: (codPoa || STICKY_PLACEHOLDER).trim(),
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

  // 5. Vincular Cuentas Bancarias con Proyectos
  console.log('🔗 Vinculando Cuentas Bancarias con Proyectos...');
  const relacionCuentas: Record<string, string[]> = {
    '34-6839-001-8': ['EROL_2', 'GIZ', 'MOORE'],
    '34-6839-002-6': ['AAF9_PANDO', 'AAF_FORT', 'AAF9_BENI', 'AAF_10'],
    '34-6839-003-4': ['BID_PV'],
    '34-6839-005-1': ['RE_WILD', 'RE_WILD_2', 'AFD'],
    '34-6839-008-5': ['FCF_3'],
    '34-6839-009-3': ['KATZ'],
    '34-6839-012-3': ['SUECIA_PV'],
    '34-6839-017-4': ['RECURSOS_PROPIOS'],
    '34-6839-018-2': ['AKAM_CCAM', 'IIED'],
    '34-6839-020-4': ['DOROTHY', 'RAINFOREST'],
  };

  for (const [numeroCuenta, proyectos] of Object.entries(relacionCuentas)) {
    const cuenta = await prisma.cuentaBancaria.findUnique({
      where: { numeroCuenta },
    });

    if (!cuenta) {
      console.warn(` Cuenta no encontrada: ${numeroCuenta}`);
      continue;
    }

    for (const nombreProyecto of proyectos) {
      // Intentar vincular solo si el proyecto existe
      await prisma.proyecto.updateMany({
        where: { nombre: nombreProyecto },
        data: { cuentaBancariaId: cuenta.id },
      });
    }
  }

  console.log(`✅ Seeding completado.`);
  console.log(`--- Resumen ---`);
  console.log(`Cuentas Bancarias: ${cuentaCount}`);
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
