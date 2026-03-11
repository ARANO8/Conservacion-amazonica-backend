/**
 * rendicion-schema.ts
 *
 * Esquemas Zod para el módulo de Rendición de Fondos (SIFIN).
 * Incluye validación de GastoRendicion, DeclaracionJurada y el cuerpo
 * completo de creación/actualización de una Rendicion.
 *
 * Uso:
 *   import { CreateRendicionSchema, type CreateRendicionInput } from 'types/rendicion-schema';
 *   const datos = CreateRendicionSchema.parse(body);
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (reflejan los valores del schema.prisma)
// ---------------------------------------------------------------------------

export const TipoDocumentoEnum = z.enum(['FACTURA', 'RECIBO']);
export type TipoDocumento = z.infer<typeof TipoDocumentoEnum>;

export const EstadoRendicionEnum = z.enum([
  'PENDIENTE',
  'APROBADA',
  'OBSERVADA',
  'RECHAZADA',
]);
export type EstadoRendicion = z.infer<typeof EstadoRendicionEnum>;

// ---------------------------------------------------------------------------
// Sub-esquema: GastoRendicion
// Un gasto respaldado con documento (factura o recibo) dentro de la rendición.
// ---------------------------------------------------------------------------

export const GastoRendicionSchema = z.object({
  /** Tipo de comprobante presentado */
  tipoDocumento: TipoDocumentoEnum,

  /** Número o código del documento (ej. "001-001-00012345") */
  nroDocumento: z
    .string()
    .trim()
    .min(1, 'El número de documento no puede estar vacío')
    .max(50, 'El número de documento no puede superar 50 caracteres'),

  /** Fecha de emisión del documento (ISO 8601 o Date) */
  fecha: z.coerce.date(),

  /** Descripción del bien o servicio adquirido */
  detalle: z
    .string()
    .trim()
    .min(3, 'El detalle debe tener al menos 3 caracteres')
    .max(255, 'El detalle no puede superar 255 caracteres'),

  /** Monto total del documento en Bs. (acepta hasta 2 decimales) */
  monto: z
    .number()
    .positive('El monto debe ser mayor a 0')
    .refine((v) => Number((v * 100).toFixed(0)) === Math.round(v * 100), {
      message: 'El monto acepta hasta 2 decimales',
    }),
});

export type GastoRendicionInput = z.infer<typeof GastoRendicionSchema>;

// ---------------------------------------------------------------------------
// Sub-esquema: DeclaracionJurada
// Gastos menores sin respaldo documental, declarados bajo juramento.
// ---------------------------------------------------------------------------

export const DeclaracionJuradaSchema = z.object({
  /** Fecha en que se incurrió en el gasto */
  fecha: z.coerce.date(),

  /** Descripción del gasto declarado (ej. "Pasaje microbús La Paz-El Alto") */
  detalle: z
    .string()
    .trim()
    .min(3, 'El detalle debe tener al menos 3 caracteres')
    .max(255, 'El detalle no puede superar 255 caracteres'),

  /** Monto en Bs. (acepta hasta 2 decimales) */
  monto: z
    .number()
    .positive('El monto debe ser mayor a 0')
    .refine((v) => Number((v * 100).toFixed(0)) === Math.round(v * 100), {
      message: 'El monto acepta hasta 2 decimales',
    }),
});

export type DeclaracionJuradaInput = z.infer<typeof DeclaracionJuradaSchema>;

// ---------------------------------------------------------------------------
// Esquema principal: CreateRendicion
// Cuerpo esperado al registrar una nueva rendición para una solicitud.
// ---------------------------------------------------------------------------

export const CreateRendicionSchema = z
  .object({
    /** ID de la Solicitud que se está rindiendo (debe estar en estado DESEMBOLSADO) */
    solicitudId: z
      .number()
      .int('El ID de solicitud debe ser un entero')
      .positive('El ID de solicitud debe ser mayor a 0'),

    /** Fecha en que se presenta la rendición (por defecto: hoy) */
    fechaRendicion: z.coerce.date().optional(),

    /** Observaciones adicionales del responsable */
    observaciones: z
      .string()
      .trim()
      .max(500, 'Las observaciones no pueden superar 500 caracteres')
      .nullish(),

    /** Gastos respaldados con facturas o recibos */
    gastosRendicion: z.array(GastoRendicionSchema).default([]),

    /** Gastos menores sin documento, bajo declaración jurada */
    declaracionesJuradas: z.array(DeclaracionJuradaSchema).default([]),
  })
  .refine(
    (data) =>
      data.gastosRendicion.length > 0 || data.declaracionesJuradas.length > 0,
    {
      message:
        'La rendición debe contener al menos un gasto o una declaración jurada',
      path: ['gastosRendicion'],
    },
  );

export type CreateRendicionInput = z.infer<typeof CreateRendicionSchema>;

// ---------------------------------------------------------------------------
// Esquema: UpdateRendicion
// Permite modificar campos de una rendición en estado PENDIENTE u OBSERVADA.
// ---------------------------------------------------------------------------

export const UpdateRendicionSchema = z.object({
  /** Nuevo estado asignado por el Tesorero/Admin */
  estado: EstadoRendicionEnum.optional(),

  /** Observaciones del revisor al observar o rechazar */
  observaciones: z
    .string()
    .trim()
    .max(500, 'Las observaciones no pueden superar 500 caracteres')
    .nullish(),

  /** Reemplaza la lista completa de gastos con documentos */
  gastosRendicion: z.array(GastoRendicionSchema).optional(),

  /** Reemplaza la lista completa de declaraciones juradas */
  declaracionesJuradas: z.array(DeclaracionJuradaSchema).optional(),
});

export type UpdateRendicionInput = z.infer<typeof UpdateRendicionSchema>;

// ---------------------------------------------------------------------------
// Tipos de respuesta (forma la que devuelve el servicio al cliente)
// ---------------------------------------------------------------------------

/** Forma de un GastoRendicion tal como llega desde Prisma */
export interface GastoRendicionResponse {
  id: number;
  tipoDocumento: TipoDocumento;
  nroDocumento: string;
  fecha: Date;
  detalle: string;
  monto: string; // Prisma.Decimal → serializado a string
  rendicionId: number;
}

/** Forma de una DeclaracionJurada tal como llega desde Prisma */
export interface DeclaracionJuradaResponse {
  id: number;
  fecha: Date;
  detalle: string;
  monto: string; // Prisma.Decimal → serializado a string
  rendicionId: number;
}

/** Forma de la Rendicion completa con sus relaciones */
export interface RendicionResponse {
  id: number;
  fechaRendicion: Date;
  montoRespaldado: string;
  saldoLiquido: string;
  estado: EstadoRendicion;
  observaciones: string | null;
  solicitudId: number;
  gastosRendicion: GastoRendicionResponse[];
  declaracionesJuradas: DeclaracionJuradaResponse[];
}
