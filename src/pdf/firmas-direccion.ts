import { Rol } from '@prisma/client';
import {
  CARGO_DIRECTOR_EJECUTIVO,
  DESTINATARIO_ANEXOS,
} from '../common/constants/financial.constants';
import { PrismaService } from '../prisma/prisma.service';

export interface FirmaDocumento {
  nombre: string;
  cargo: string;
}

export interface FirmasDireccion {
  revisadoPor: FirmaDocumento;
  aprobadoPor: FirmaDocumento;
}

/**
 * Formato de ACEAA para los anexos: revisa la Dirección Financiera (el
 * usuario TESORERO) y aprueba el Director Ejecutivo.
 */
export async function firmasDireccion(
  prisma: PrismaService,
): Promise<FirmasDireccion> {
  const financiera = await prisma.usuario.findFirst({
    where: { rol: Rol.TESORERO, deletedAt: null },
    select: { nombreCompleto: true, cargo: true },
    orderBy: { id: 'asc' },
  });

  return {
    revisadoPor: {
      nombre: financiera?.nombreCompleto ?? '',
      cargo: financiera?.cargo ?? 'DIRECTOR FINANCIERO',
    },
    aprobadoPor: {
      nombre: DESTINATARIO_ANEXOS,
      cargo: CARGO_DIRECTOR_EJECUTIVO,
    },
  };
}
