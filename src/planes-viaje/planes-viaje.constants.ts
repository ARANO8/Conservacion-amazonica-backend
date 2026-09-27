import { Prisma } from '@prisma/client';
import { USER_SAFE_SELECT } from '../solicitudes/solicitudes.constants';

export const PLAN_VIAJE_INCLUDE = {
  usuario: { select: USER_SAFE_SELECT },
  directorPrograma: { select: USER_SAFE_SELECT },
  actividades: {
    orderBy: { orden: 'asc' as const },
    include: {
      participantesInstitucionales: {
        select: { id: true, nombreCompleto: true, cargo: true },
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
    },
  },
  historial: {
    include: { usuario: { select: USER_SAFE_SELECT } },
    orderBy: { fecha: 'asc' as const },
  },
} satisfies Prisma.PlanViajeInclude;

export type PlanViajeCompleto = Prisma.PlanViajeGetPayload<{
  include: typeof PLAN_VIAJE_INCLUDE;
}>;

/** El formato impreso deja al menos estas filas en el cronograma. */
export const MIN_FILAS_ANEXO1 = 7;
