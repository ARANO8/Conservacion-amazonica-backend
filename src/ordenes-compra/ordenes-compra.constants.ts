import { Prisma } from '@prisma/client';

export const ORDEN_INCLUDE = {
  usuarioEmisor: {
    select: { id: true, nombreCompleto: true, email: true, cargo: true },
  },
  cuadroComparativo: {
    select: { id: true, codigoCuadro: true },
  },
  items: {
    orderBy: { orden: 'asc' },
    include: {
      cuadroItem: {
        select: { id: true, descripcion: true, cuadroId: true },
      },
    },
  },
} satisfies Prisma.OrdenCompraInclude;

export const DIRECTOR_FINANCIERO = {
  nombre: 'Shirley Ramírez Teodovich',
  cargo: 'DIRECTORA FINANCIERA',
};

export const DIRECTOR_EJECUTIVO = {
  nombre: 'Marcos Terán Valenzuela',
  cargo: 'DIRECTOR EJECUTIVO',
};

export const ACEAA_NIT = '195326026';
export const ACEAA_TC = '6.96';
