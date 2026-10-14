import { Prisma } from '@prisma/client';
import { USER_SAFE_SELECT } from '../solicitudes/solicitudes.constants';

export const LIQUIDACION_INCLUDE = {
  usuario: { select: USER_SAFE_SELECT },
  directorPrograma: { select: USER_SAFE_SELECT },
  hojas: {
    orderBy: { orden: 'asc' as const },
    include: {
      usuario: { select: { id: true, nombreCompleto: true } },
      filas: {
        orderBy: { orden: 'asc' as const },
        include: { concepto: { select: { id: true, nombre: true } } },
      },
    },
  },
  solicitud: {
    select: {
      id: true,
      codigoSolicitud: true,
      estado: true,
      usuarioEmisorId: true,
      aprobadorId: true,
      deletedAt: true,
      proyecto: true,
      presupuestos: {
        select: {
          id: true,
          poa: {
            select: {
              codigoPoa: true,
              actividad: { select: { detalleDescripcion: true } },
              estructura: {
                select: { proyecto: { select: { nombre: true } } },
              },
            },
          },
        },
      },
    },
  },
  historial: {
    include: { usuario: { select: USER_SAFE_SELECT } },
    orderBy: { fecha: 'asc' as const },
  },
} satisfies Prisma.LiquidacionViaticosInclude;

export type LiquidacionCompleta = Prisma.LiquidacionViaticosGetPayload<{
  include: typeof LIQUIDACION_INCLUDE;
}>;
