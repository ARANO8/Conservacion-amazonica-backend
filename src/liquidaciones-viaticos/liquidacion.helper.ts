import { Prisma } from '@prisma/client';
import { FACTOR_RETENCION_VIATICOS } from '../common/constants/financial.constants';

/**
 * Cálculo del ANEXO 5. Se parte del líquido (lo que la persona recibe) y el
 * bruto sale de él con el factor del RC-IVA, igual que la rendición trata un
 * gasto LV: así el total a pagar queda exacto (250 × 2 = 500) y el gasto
 * importado cuadra con la hoja.
 *
 * El frontend replica esta fórmula para la vista previa
 * (`lib/liquidacion-viaticos.ts`): si cambia una, debe cambiar la otra.
 */

const CERO = () => new Prisma.Decimal(0);
const redondear = (v: Prisma.Decimal) => v.toDecimalPlaces(2);

/** Porcentajes que admite el manual: viático completo o medio viático. */
export const PORCENTAJES_VIATICO = [100, 50] as const;

/** "Escala" del formulario: el tipo de destino de cada tarifa del catálogo. */
const ESCALA_POR_CONCEPTO: Record<string, string> = {
  CIUDADES_PRINCIPALES: 'Ciudad',
  CIUDADES_INTERMEDIAS: 'Ciudad intermedia',
  PUEBLOS: 'Pueblo',
  COMUNIDADES: 'Comunidad',
  EXTERIOR: 'Exterior',
  PAISES_SUDAMERICA: 'Exterior',
  PAISES_NORTEAMERICA_EUROPA: 'Exterior',
  PAISES_LIMITROFES: 'Exterior',
};

export function escalaDeConcepto(nombreConcepto: string): string {
  return ESCALA_POR_CONCEPTO[nombreConcepto] ?? nombreConcepto;
}

/** "Viático Ciudad 100%", como la columna Descripción del formulario. */
export function descripcionFila(
  nombreConcepto: string,
  porcentaje: number,
): string {
  return `Viático ${escalaDeConcepto(nombreConcepto)} ${porcentaje}%`;
}

export interface FilaCalculada {
  totalLiquido: Prisma.Decimal;
  totalBruto: Prisma.Decimal;
}

/** Una fila: tarifa líquida por día × días × porcentaje. */
export function calcularFila(
  tarifaLiquida: Prisma.Decimal.Value,
  dias: Prisma.Decimal.Value,
  porcentaje: number,
): FilaCalculada {
  const totalLiquido = redondear(
    new Prisma.Decimal(tarifaLiquida).mul(dias).mul(porcentaje).div(100),
  );
  return {
    totalLiquido,
    totalBruto: redondear(totalLiquido.div(FACTOR_RETENCION_VIATICOS)),
  };
}

/** Importe por día que imprime el formulario: la tarifa en bruto. */
export function importeDiaBruto(
  tarifaLiquida: Prisma.Decimal.Value,
  porcentaje: number,
): Prisma.Decimal {
  return redondear(
    new Prisma.Decimal(tarifaLiquida)
      .mul(porcentaje)
      .div(100)
      .div(FACTOR_RETENCION_VIATICOS),
  );
}

export interface TotalesHoja {
  totalLiquido: Prisma.Decimal;
  totalBruto: Prisma.Decimal;
  rcIva: Prisma.Decimal;
}

/**
 * Totales de una hoja. El bruto es la suma de los brutos de sus filas (lo que
 * el formulario muestra fila por fila) y la retención es la diferencia.
 */
export function totalizarHoja(filas: FilaCalculada[]): TotalesHoja {
  const totalLiquido = filas.reduce((s, f) => s.add(f.totalLiquido), CERO());
  const totalBruto = filas.reduce((s, f) => s.add(f.totalBruto), CERO());
  return { totalLiquido, totalBruto, rcIva: totalBruto.sub(totalLiquido) };
}

/** La escala de la hoja: la del tipo de destino con más días. */
export function escalaPredominante(
  filas: { nombreConcepto: string; dias: Prisma.Decimal.Value }[],
): string {
  const dias = new Map<string, Prisma.Decimal>();
  for (const f of filas) {
    const escala = escalaDeConcepto(f.nombreConcepto);
    dias.set(escala, (dias.get(escala) ?? CERO()).add(f.dias));
  }
  let mejor = '';
  let max = CERO();
  for (const [escala, total] of dias) {
    if (total.gt(max)) {
      mejor = escala;
      max = total;
    }
  }
  return mejor;
}

// ---------------------------------------------------------------------------
// Precarga desde la solicitud
// ---------------------------------------------------------------------------

export interface ViaticoFuente {
  tipoDestino: string;
  dias: Prisma.Decimal.Value;
  conceptoId: number;
  solicitudPresupuestoId: number;
  concepto: { nombre: string };
  planificaciones: {
    participantesInstitucionales: { id: number }[];
  }[];
}

export interface FilaPrecargada {
  conceptoId: number;
  nombreConcepto: string;
  porcentaje: number;
  dias: number;
  solicitudPresupuestoId: number;
}

/**
 * Filas por persona: cada viático INSTITUCIONAL reparte sus días a todo el
 * personal ACEAA de las actividades que cubre. Las filas de la misma tarifa y
 * partida se suman.
 */
export function precargarFilasPorPersona(
  viaticos: ViaticoFuente[],
): Map<number, FilaPrecargada[]> {
  const porPersona = new Map<number, Map<string, FilaPrecargada>>();

  for (const v of viaticos) {
    if (v.tipoDestino !== 'INSTITUCIONAL') continue;
    const personas = new Set(
      v.planificaciones.flatMap((p) =>
        p.participantesInstitucionales.map((u) => u.id),
      ),
    );
    for (const usuarioId of personas) {
      const filas =
        porPersona.get(usuarioId) ?? new Map<string, FilaPrecargada>();
      const clave = `${v.conceptoId}-${v.solicitudPresupuestoId}`;
      const previa = filas.get(clave);
      filas.set(clave, {
        conceptoId: v.conceptoId,
        nombreConcepto: v.concepto.nombre,
        porcentaje: 100,
        dias: Number(v.dias) + (previa?.dias ?? 0),
        solicitudPresupuestoId: v.solicitudPresupuestoId,
      });
      porPersona.set(usuarioId, filas);
    }
  }

  return new Map(
    [...porPersona].map(([id, filas]) => [id, [...filas.values()]]),
  );
}
