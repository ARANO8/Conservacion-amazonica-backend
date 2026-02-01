import { Prisma } from '@prisma/client';

export const IVA_RATE = new Prisma.Decimal(0.13);
export const IT_RATE = new Prisma.Decimal(0.03);
export const IUE_COMPRA_RATE = new Prisma.Decimal(0.05);

export const MONEDA_DEFAULT = 'Bs';
export const LOCALE_DEFAULT = 'es-BO';
