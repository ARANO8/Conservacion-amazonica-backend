import { EstadoSolicitud, Prisma } from '@prisma/client';

export const IVA_RATE = new Prisma.Decimal(0.13);
export const IT_RATE = new Prisma.Decimal(0.03);
export const IUE_COMPRA_RATE = new Prisma.Decimal(0.05);

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
