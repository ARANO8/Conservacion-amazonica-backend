import { Prisma } from '@prisma/client';

export const CUADRO_USUARIO_SELECT = {
  id: true,
  nombreCompleto: true,
  email: true,
  cargo: true,
} satisfies Prisma.UsuarioSelect;

export const CUADRO_INCLUDE = {
  usuarioEmisor: { select: CUADRO_USUARIO_SELECT },
  cotizaciones: {
    orderBy: { orden: 'asc' },
    include: {
      cotizacion: { select: { id: true, codigoCotizacion: true } },
    },
  },
  items: {
    orderBy: { orden: 'asc' },
    include: { precios: true },
  },
  cotizacionRecomendada: true,
} satisfies Prisma.CuadroComparativoInclude;
