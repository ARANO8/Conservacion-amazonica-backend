import { EstadoSolicitud, Moneda, Prisma } from '@prisma/client';

export const IVA_RATE = new Prisma.Decimal(0.13);
export const IT_RATE = new Prisma.Decimal(0.03);
export const IUE_COMPRA_RATE = new Prisma.Decimal(0.05);

/**
 * Retención impositiva por servicios del ANEXO 6 (Declaración Jurada de
 * Movilidad): 16%. El total líquido cierra contra lo que el declarante gastó
 * porque el divisor de grossing-up es 1 - esta tasa.
 */
export const RETENCION_MOVILIDAD_RATE = new Prisma.Decimal(0.16);

/**
 * Divisor de grossing-up del ANEXO 6 (celda F14 del Excel, "no tocar este
 * valor"): 1 - RETENCION_MOVILIDAD_RATE.
 */
export const FACTOR_MOVILIDAD = new Prisma.Decimal(0.84);

/**
 * Divisor de grossing-up de los viáticos (RC-IVA 13%), institucionales y de
 * terceros por igual según el Instructivo de Viaje y Viáticos (03/08/2026).
 */
export const FACTOR_RETENCION_VIATICOS = new Prisma.Decimal(0.87);

/**
 * Tipo de cambio oficial USD → Bs para los viáticos internacionales (Nota 1
 * del Instructivo de Viaje y Viáticos). Fijo por ahora: cuando el ADMIN pueda
 * editarlo, este es el único punto que debe pasar a leerse de la base.
 */
export const TIPO_CAMBIO_USD_BOB = new Prisma.Decimal(6.96);

/** Tarifa de catálogo expresada en Bs, sea cual sea su moneda de origen. */
export function tarifaEnBolivianos(
  precio: Prisma.Decimal | number | string,
  moneda: Moneda,
): Prisma.Decimal {
  const valor = new Prisma.Decimal(precio);
  return moneda === Moneda.USD
    ? valor.mul(TIPO_CAMBIO_USD_BOB).toDecimalPlaces(2)
    : valor;
}

/**
 * Campo "A:" de los anexos: todos los documentos van dirigidos al Director
 * Ejecutivo, escrito tal como lo pide ACEAA.
 */
export const DESTINATARIO_ANEXOS = 'Marcos F. Terán Valenzuela';

export const MONEDA_DEFAULT = 'Bs';
export const LOCALE_DEFAULT = 'es-BO';

/**
 * Estados de solicitud que comprometen presupuesto (cuentan en
 * montoComprometido para el cálculo del saldo disponible del POA).
 * En este dominio no existe EstadoSolicitud.APROBADO explícito: PENDIENTE
 * representa solicitudes activas/en curso previas al desembolso.
 */
export const ESTADOS_COMPROMISO_ACTIVO: EstadoSolicitud[] = [
  EstadoSolicitud.PENDIENTE,
  EstadoSolicitud.DESEMBOLSADO,
  // Un contrato de consultoría compromete su presupuesto desde que nace y hasta
  // que se paga la última cuota; recién ahí pasa a EJECUTADO y suma a montoEjecutado.
  EstadoSolicitud.EN_EJECUCION,
];
