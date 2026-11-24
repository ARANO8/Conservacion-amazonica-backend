import { Sede } from '@prisma/client';

/** Cómo se escribe cada sede en los documentos ("Lugar de emisión"). */
export const ETIQUETA_SEDE: Record<Sede, string> = {
  [Sede.LA_PAZ]: 'La Paz',
  [Sede.TRINIDAD]: 'Trinidad',
  [Sede.COBIJA]: 'Cobija',
};

/** Lugar de emisión cuando el usuario no tiene sede registrada. */
export const LUGAR_EMISION_DEFAULT = 'La Paz';

export function etiquetaSede(sede: Sede | null | undefined): string {
  return sede ? ETIQUETA_SEDE[sede] : LUGAR_EMISION_DEFAULT;
}
