import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

// --- Configuración ---
const PASSWORD_DEFAULT = '123456';
const DATA_PATH = path.join(__dirname, 'seeds');

// --- Interfaces de Datos ---
interface SourceRow {
  CODIGO: string;
}

interface BudgetLineRow {
  CODIGO: string;
  DETALLE: string;
}

interface EmployeeRow {
  NOMBRE: string;
  CARGO: string;
  COMPONENTE: string;
}

// --- Ayudantes (Helpers) ---

/**
 * Carga y parsea un archivo CSV de forma genérica.
 */
function loadCsv<T>(fileName: string, options: any = {}): T[] {
  const filePath = path.join(DATA_PATH, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Archivo no encontrado: ${fileName}`);
    return [];
  }
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    ...options,
  });
}

/**
 * Genera un email estandarizado a partir del nombre completo.
 * Maneja acentos, eñes y espacios múltiples.
 */
function generateEmail(fullName: string): string {
  const cleanName = fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/ñ/g, 'n')
    .trim();

  const parts = cleanName.split(/\s+/);
  if (parts.length < 2) return `${cleanName}@aceaa.org`;

  const firstName = parts[0];
  // Tomamos el primer apellido (segunda palabra)
  const lastName = parts[1];

  return `${firstName.charAt(0)}.${lastName}@aceaa.org`;
}

async function main() {
  console.log('🚀 Iniciando sembrado de base de datos...');

  // 1. Roles
  console.log('... Sincronizando Roles');
  const roles = ['ADMIN', 'SOLICITANTE', 'APROBADOR', 'CONTADOR'];
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  // 2. Fuentes de Financiamiento
  console.log('... Cargando Fuentes de Financiamiento');
  const sourceRecords = loadCsv<SourceRow>('sources.csv');
  for (const row of sourceRecords) {
    const code = row.CODIGO?.trim();
    if (code) {
      await prisma.financingSource.upsert({
        where: { code },
        update: {},
        create: { code, name: code },
      });
    }
  }

  // 3. Partidas Presupuestarias
  console.log('... Cargando Partidas Presupuestarias');
  const budgetRecords = loadCsv<BudgetLineRow>('budget_lines.csv');
  for (const row of budgetRecords) {
    const code = row.CODIGO?.trim();
    const name = row.DETALLE?.trim();
    if (code && name) {
      await prisma.budgetLine.upsert({
        where: { code },
        update: { name },
        create: {
          code,
          name,
          category: 'GASTO CORRIENTE',
        },
      });
    }
  }

  // 4. Empleados y Usuarios
  console.log('... Cargando Empleados');
  const employeeRecords = loadCsv<EmployeeRow>('employees.csv');

  const roleSolicitante = await prisma.role.findUnique({
    where: { name: 'SOLICITANTE' },
  });
  const roleAdmin = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const hashedPassword = await bcrypt.hash(PASSWORD_DEFAULT, 10);

  if (!roleSolicitante || !roleAdmin) {
    throw new Error('Roles críticos no encontrados. Revisa el paso 1.');
  }

  for (const row of employeeRecords) {
    const { NOMBRE: fullName, CARGO: position, COMPONENTE: area } = row;
    if (!fullName) continue;

    const email = generateEmail(fullName);

    // Lógica de rol: Directores son ADMIN, el resto SOLICITANTE
    const isDirector = position?.toUpperCase().includes('DIRECTOR');
    const roleId = isDirector ? roleAdmin.id : roleSolicitante.id;

    try {
      await prisma.user.upsert({
        where: { email },
        update: {
          fullName,
          position,
          area,
          roleId,
        },
        create: {
          email,
          password: hashedPassword,
          fullName,
          position,
          area,
          roleId,
        },
      });
    } catch (error) {
      console.error(`❌ Error con usuario ${email}:`, error);
    }
  }

  console.log('✅ Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('🔴 Error en el proceso de seed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
