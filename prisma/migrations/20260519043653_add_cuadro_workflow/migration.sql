-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'VALIDADOR_COMPRAS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoAccionHistorial" ADD VALUE 'ENVIADO';
ALTER TYPE "TipoAccionHistorial" ADD VALUE 'VALIDADO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'CUADRO_PENDIENTE_VALIDACION';
ALTER TYPE "TipoNotificacion" ADD VALUE 'CUADRO_PENDIENTE_REVISION';
ALTER TYPE "TipoNotificacion" ADD VALUE 'CUADRO_OBSERVADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'CUADRO_APROBADO';

-- AlterTable
ALTER TABLE "CuadroComparativo" ADD COLUMN     "motivoObservacion" TEXT;

-- AlterTable
ALTER TABLE "HistorialAprobacion" ADD COLUMN     "cuadroComparativoId" INTEGER;

-- AlterTable
ALTER TABLE "Notificacion" ADD COLUMN     "cuadroComparativoId" INTEGER;

-- AddForeignKey
ALTER TABLE "HistorialAprobacion" ADD CONSTRAINT "HistorialAprobacion_cuadroComparativoId_fkey" FOREIGN KEY ("cuadroComparativoId") REFERENCES "CuadroComparativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_cuadroComparativoId_fkey" FOREIGN KEY ("cuadroComparativoId") REFERENCES "CuadroComparativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
