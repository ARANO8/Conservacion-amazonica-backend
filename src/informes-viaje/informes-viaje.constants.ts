import { EstadoSolicitud, Prisma } from '@prisma/client';
import { USER_SAFE_SELECT } from '../solicitudes/solicitudes.constants';

export const INFORME_VIAJE_INCLUDE = {
  usuario: { select: USER_SAFE_SELECT },
  directorPrograma: { select: USER_SAFE_SELECT },
  actividades: {
    orderBy: [{ orden: 'asc' as const }, { fecha: 'asc' as const }],
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
} satisfies Prisma.InformeViajeInclude;

export type InformeViajeCompleto = Prisma.InformeViajeGetPayload<{
  include: typeof INFORME_VIAJE_INCLUDE;
}>;

/** Solo se informa de un viaje cuyo dinero ya salió. */
export const ESTADOS_SOLICITUD_INFORMABLE: EstadoSolicitud[] = [
  EstadoSolicitud.DESEMBOLSADO,
  EstadoSolicitud.EJECUTADO,
];

/** El formato impreso deja al menos estas filas en la tabla. */
export const MIN_FILAS_ANEXO7 = 9;

export const NOTA_ANEXO7 =
  'Nota: El Informe detallado se debe hacer llegar al Coordinador de Proyectos o Director de Sede según corresponda';
