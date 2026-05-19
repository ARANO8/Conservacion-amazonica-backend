import { Prisma } from '@prisma/client';

export const COTIZACION_USUARIO_SELECT = {
  id: true,
  nombreCompleto: true,
  email: true,
  cargo: true,
} satisfies Prisma.UsuarioSelect;

export const COTIZACION_INCLUDE = {
  lineas: true,
  usuarioEmisor: { select: COTIZACION_USUARIO_SELECT },
} satisfies Prisma.CotizacionInclude;
