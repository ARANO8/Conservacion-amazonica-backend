import { EstadoSolicitud, Prisma } from '@prisma/client';

export const IVA_RATE = new Prisma.Decimal(0.13);
export const IT_RATE = new Prisma.Decimal(0.03);
export const IUE_COMPRA_RATE = new Prisma.Decimal(0.05);

/**
 * Retención impositiva por servicios del ANEXO 6 (Declaración Jurada de
 * Movilidad): IUE 12.5% + IT 3%. La planilla en Excel rotula 15.5% pero la
 * celda de retención arrastra un `*16%`; aquí se usa la tasa correcta, que es
 * la que hace cerrar el total líquido contra lo que el declarante gastó.
 */
export const RETENCION_MOVILIDAD_RATE = new Prisma.Decimal(0.155);

/**
 * Divisor de grossing-up del ANEXO 6 (celda F14 del Excel, "no tocar este
 * valor"): 1 - RETENCION_MOVILIDAD_RATE.
 */
export const FACTOR_MOVILIDAD = new Prisma.Decimal(0.845);

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
