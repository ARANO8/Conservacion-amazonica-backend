import { Prisma } from '@prisma/client';

/**
 * Desglose de retenciones para el ANEXO 4.
 *
 * El monto total de impuestos ya está persistido en `GastoRendicion`; lo que
 * falta es repartirlo entre RC-IVA, IUE e IT. Se reparte por fracciones sobre
 * el total guardado (misma técnica que `solicitudes.helper.ts`) en vez de
 * recalcular porcentajes sobre el bruto: así la suma de las tres columnas
 * siempre cierra exactamente contra `montoImpuestos`, sin desvío por redondeo.
 */

function redondear(value: Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

export interface DesgloseRetenciones {
  rcIva: Prisma.Decimal;
  iue: Prisma.Decimal;
  it: Prisma.Decimal;
}

const CERO: () => DesgloseRetenciones = () => ({
  rcIva: new Prisma.Decimal(0),
  iue: new Prisma.Decimal(0),
  it: new Prisma.Decimal(0),
});

/**
 * Quita las tildes descomponiendo el texto y descartando los signos
 * diacríticos combinantes (rango Unicode 0x300–0x36F).
 */
function sinTildes(texto: string): string {
  return [...texto.normalize('NFD')]
    .filter((c) => {
      const code = c.codePointAt(0) ?? 0;
      return code < 0x300 || code > 0x36f;
    })
    .join('');
}

/** Categoría del gasto derivada del nombre de la partida POA. */
function categoriaDePartida(nombrePartida?: string | null): string {
  const n = sinTildes(nombrePartida ?? '').toUpperCase();
  if (n.includes('VIATICO')) return 'VIATICO';
  if (n.includes('HOSPEDAJE') || n.includes('ALOJAMIENTO')) return 'HOSPEDAJE';
  return 'GENERAL';
}

export function desglosarRetenciones(
  montoImpuestos: Prisma.Decimal | number,
  tipoDocumento: string,
  tipoRetencion?: string | null,
  nombrePartida?: string | null,
): DesgloseRetenciones {
  const total = new Prisma.Decimal(montoImpuestos ?? 0);
  if (total.lte(0)) return CERO();

  // Sin retención: factor 1.00
  if (
    tipoDocumento === 'FACTURA' ||
    tipoDocumento === 'DJ' ||
    tipoDocumento === 'PPT'
  ) {
    return CERO();
  }

  const categoria = categoriaDePartida(nombrePartida);

  // Factor 0.87 — sólo RC-IVA 13%
  if (
    tipoDocumento === 'LV' ||
    (tipoDocumento === 'RECIBO' && categoria === 'VIATICO')
  ) {
    return { ...CERO(), rcIva: redondear(total) };
  }

  // Factor 0.92 — IUE 5% + IT 3% (el total equivale al 8% del bruto)
  const esBien =
    tipoRetencion === 'BIEN' &&
    categoria === 'GENERAL' &&
    (tipoDocumento === 'RECIBO' || tipoDocumento === 'BOLETA');

  if (esBien) {
    const iue = redondear(total.mul(5).div(8));
    return { ...CERO(), iue, it: redondear(total.sub(iue)) };
  }

  // Resto (0.84) — 13% + IT 3% (el total equivale al 16% del bruto)
  const rcIva = redondear(total.mul(13).div(16));
  return { ...CERO(), rcIva, it: redondear(total.sub(rcIva)) };
}
