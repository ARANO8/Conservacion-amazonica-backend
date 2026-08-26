import { Prisma } from '@prisma/client';
import {
  FACTOR_MOVILIDAD,
  RETENCION_MOVILIDAD_RATE,
} from '../common/constants/financial.constants';

/** Redondeo monetario estándar del dominio: 2 decimales, medio hacia arriba. */
function round2(valor: Prisma.Decimal): Prisma.Decimal {
  return valor.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Grossing-up del ANEXO 6: el declarante escribe lo que gastó de su bolsillo y
 * el monto que va impreso en el anexo es ese gasto más los impuestos que la
 * institución retiene (columna E = F / 0.845 en el Excel).
 */
export function calcularMonto(
  montoGastado: Prisma.Decimal.Value,
): Prisma.Decimal {
  return round2(new Prisma.Decimal(montoGastado).div(FACTOR_MOVILIDAD));
}

export interface ResumenMovilidad {
  totalBruto: Prisma.Decimal;
  retencion: Prisma.Decimal;
  totalLiquido: Prisma.Decimal;
}

/**
 * Pie del ANEXO 6: TOTAL, "menos retención impositiva por servicios 15.5%" y
 * TOTAL líquido.
 */
export function resumirDeclaracion(montos: Prisma.Decimal[]): ResumenMovilidad {
  const totalBruto = round2(
    montos.reduce<Prisma.Decimal>(
      (acc, monto) => acc.plus(monto),
      new Prisma.Decimal(0),
    ),
  );
  const retencion = round2(totalBruto.mul(RETENCION_MOVILIDAD_RATE));

  return {
    totalBruto,
    retencion,
    totalLiquido: round2(totalBruto.minus(retencion)),
  };
}
