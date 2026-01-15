import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

// --- Configuración ---
const PASSWORD_DEFAULT = '123456';
// Ajusta esta ruta si tus CSVs están en otro lado (ej: 'prisma/seeds')
const DATA_PATH = path.join(__dirname, 'seeds');

// --- UUIDs CRÍTICOS PARA EL FRONTEND ---
// Estos IDs deben ser estáticos para que los Mocks del Frontend coincidan
const FIXED_UUIDS = {
  budgetLinePasajes: '550e8400-e29b-41d4-a716-446655440000', // Partida 30000
  financingSourceRP: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // Fuente RP
};

// --- Interfaces de Datos ---
interface SourceRow {
  CODIGO: string; // ej: "RP", "BID-PV"
  NOMBRE?: string; // A veces el CSV no trae nombre, usaremos el código
}

interface BudgetLineRow {
  CODIGO: string; // ej: "30000"
  DETALLE: string; // ej: "Pasajes y Viáticos"
}

interface EmployeeRow {
  NOMBRE: string;
  CARGO: string;
  COMPONENTE: string;
}

interface PoaActivityRow {
  code: string;
  project: string;
  og?: string | null;
  oe?: string | null;
  op?: string | null;
  ac?: string | null;
  group?: string | null;
  poaBudgetLine?: string | null;
  activityCode?: string | null;
  description: string;
  unitCost?: number | null;
  totalCost?: number | null;
}

// Helper to parse numbers like "50.000,00" or "52.403,71"
function parseSpanishNumber(val: string): number | null {
  if (!val || val.trim() === '') return null;
  // Remove thousand separator (.) and replace decimal separator (,) with (.)
  const cleaned = val.replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// --- Ayudantes (Helpers) ---
function loadCsv<T>(fileName: string): T[] {
  const filePath = path.join(DATA_PATH, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Archivo no encontrado: ${filePath}`);
    return [];
  }
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true, // Importante para manejar caracteres raros al inicio
  });
}

function loadPoaCsv(fileName: string): PoaActivityRow[] {
  const filePath = path.join(DATA_PATH, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Archivo no encontrado: ${filePath}`);
    return [];
  }
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  // Formulario 6 skip headers until line 10, data starts at line 11
  const records = parse(fileContent, {
    from_line: 11,
    skip_empty_lines: true,
    trim: true,
  });

  return records.map((record: string[]) => ({
    og: record[0]?.trim() || null,
    oe: record[1]?.trim() || null,
    op: record[2]?.trim() || null,
    ac: record[3]?.trim() || null,
    code: record[4]?.trim(),
    project: record[5]?.trim(),
    group: record[6]?.trim() || null,
    poaBudgetLine: record[7]?.trim() || null,
    activityCode: record[8]?.trim() || null,
    description: record[9]?.trim(),
    unitCost: parseSpanishNumber(record[11]),
    totalCost: parseSpanishNumber(record[12]),
  }));
}

function generateEmail(fullName: string, usedEmails: Set<string>): string {
  const normalized = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/ü/g, 'u')
    .trim();

  const parts = normalized.split(/\s+/);
  if (parts.length < 1) return 'info@conservacion.gob.bo';

  const firstName = parts[0];
  let firstSurname = '';

  // Lógica: 2 palabras -> última, 3 o 4 palabras -> penúltima
  if (parts.length === 2) {
    firstSurname = parts[1];
  } else if (parts.length >= 3) {
    firstSurname = parts[parts.length - 2];
  } else {
    firstSurname = parts[0];
  }

  const baseInitials = firstName[0];
  let email = `${baseInitials}${firstSurname}@conservacion.gob.bo`;

  // Control de unicidad (si el correo ya existe, intentamos con la segunda letra o un contador)
  if (usedEmails.has(email)) {
    if (firstName.length > 1) {
      email = `${firstName[0]}${firstName[1]}${firstSurname}@conservacion.gob.bo`;
    }

    let counter = 2;
    const baseWithTwoLetters = email.split('@')[0];
    while (usedEmails.has(email)) {
      email = `${baseWithTwoLetters}${counter}@conservacion.gob.bo`;
      counter++;
    }
  }

  usedEmails.add(email);
  return email;
}

async function main() {
  console.log('🚀 Iniciando sembrado de base de datos (Master Seed)...');

  // Encriptar password una sola vez
  const hashedPassword = await bcrypt.hash(PASSWORD_DEFAULT, 10);

  // =================================================================
  // 1. FUENTES DE FINANCIAMIENTO (Sources)
  // =================================================================
  console.log('💰 Cargando Fuentes de Financiamiento...');
  const sourceRecords = loadCsv<SourceRow>('sources.csv'); // Asegúrate que el archivo se llame así

  for (const row of sourceRecords) {
    const code = row.CODIGO?.trim();
    if (!code) continue;

    // Si es "RP", forzamos el UUID mágico
    const isFixed = code === 'RP' || code === 'RECURSOS PROPIOS';
    const id = isFixed ? FIXED_UUIDS.financingSourceRP : undefined;

    // Usamos el código o el nombre si existe (algunos CSV solo tienen codigo)
    const name = row.NOMBRE || code;

    await prisma.financingSource.upsert({
      where: { code },
      update: {
        // No actualizamos ID para evitar choques P2002
      },
      create: {
        id: id,
        code,
        name,
      },
    });
  }

  // =================================================================
  // 2. PARTIDAS PRESUPUESTARIAS (Budget Lines)
  // =================================================================
  console.log('📊 Cargando Partidas Presupuestarias...');
  const budgetRecords = loadCsv<BudgetLineRow>('budget_lines.csv');

  for (const row of budgetRecords) {
    const code = row.CODIGO?.trim();
    const name = row.DETALLE?.trim();
    if (!code || !name) continue;

    // Si es la partida 30000, forzamos el UUID mágico
    const isFixed = code === '30000';
    const id = isFixed ? FIXED_UUIDS.budgetLinePasajes : undefined;

    await prisma.budgetLine.upsert({
      where: { code },
      update: {
        // No actualizamos ID para evitar choques P2002
      },
      create: {
        id: id,
        code,
        name,
        category: 'GASTO CORRIENTE', // Valor por defecto útil
      },
    });
  }

  // Cargando Estructura POA (Tabla Maestra)
  console.log('🌳 Cargando Estructura POA...');
  const poaRecords = loadPoaCsv('Formulario 6.csv');

  // Limpiamos la tabla maestra para evitar duplicados en re-seed ya que no hay clave única natural
  await prisma.poaActivity.deleteMany();

  // Insertamos todos los registros como espejo del CSV
  const poaData = poaRecords
    .filter((row) => row.code && row.project) // Robustness filter
    .map((row) => ({
      og: row.og,
      oe: row.oe,
      op: row.op,
      ac: row.ac,
      code: row.code,
      project: row.project,
      group: row.group,
      poaBudgetLine: row.poaBudgetLine,
      activityCode: row.activityCode,
      description: row.description,
      unitCost: row.unitCost,
      totalCost: row.totalCost,
    }));

  await prisma.poaActivity.createMany({
    data: poaData,
  });

  console.log(`✅ ${poaData.length} registros POA procesados.`);

  // =================================================================
  // 4. ROLES (Aseguramos que existan)
  // =================================================================
  console.log('🛡️  Verificando Roles...');

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: { name: 'USER' },
  });

  // =================================================================
  // 4. USUARIOS (Admin + Empleados)
  // =================================================================
  console.log('👤 Cargando Usuarios...');

  // 4.1 Usuario Super Admin (Para que entres YA)
  await prisma.user.upsert({
    where: { email: 'admin@admin.com' },
    update: {
      password: hashedPassword,
      role: { connect: { id: adminRole.id } },
    },
    create: {
      email: 'admin@admin.com',
      fullName: 'Super Admin',
      password: hashedPassword,
      role: { connect: { id: adminRole.id } },
      position: 'SISTEMAS',
      area: 'DIRECCION',
    },
  });

  // 4.2 Empleados desde CSV
  // Nota: Usamos 'employees2.csv' porque ese fue el que subiste con datos completos
  const employeeRecords = loadCsv<EmployeeRow>('employees.csv');
  const usedEmails = new Set<string>(['admin@admin.com']);

  for (const row of employeeRecords) {
    const fullName = row.NOMBRE?.trim();
    const position = row.CARGO?.trim();
    const area = row.COMPONENTE?.trim();

    if (!fullName) continue;

    const email = generateEmail(fullName, usedEmails);

    // Lógica simple de roles basada en el cargo
    const isDirector = position?.toUpperCase().includes('DIRECTOR');
    const roleToConnect = isDirector
      ? { id: adminRole.id }
      : { id: userRole.id };

    try {
      await prisma.user.upsert({
        where: { email },
        update: {
          fullName: fullName,
          position,
          area,
          role: { connect: roleToConnect },
          password: hashedPassword, // Actualizamos pass por si acaso
        },
        create: {
          email,
          password: hashedPassword,
          fullName: fullName,
          position,
          area,
          role: { connect: roleToConnect },
        },
      });
    } catch (error) {
      console.error(`❌ Error importando ${fullName}:`, error);
    }
  }

  console.log('✅ Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('🔴 Error crítico en el seed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
