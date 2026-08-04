-- AlterEnum
ALTER TYPE "EstadoPagoParcial" ADD VALUE 'OBSERVADO';

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'PAGO_OBSERVADO';

-- AlterTable
ALTER TABLE "PagoParcial" ADD COLUMN     "observacion" VARCHAR(500);
