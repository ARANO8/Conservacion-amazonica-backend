-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoDocumento" ADD VALUE 'BOLETA';
ALTER TYPE "TipoDocumento" ADD VALUE 'LV';
ALTER TYPE "TipoDocumento" ADD VALUE 'DJ';
ALTER TYPE "TipoDocumento" ADD VALUE 'PPT';
ALTER TYPE "TipoDocumento" ADD VALUE 'PAT';
ALTER TYPE "TipoDocumento" ADD VALUE 'PVT';

-- AlterTable
ALTER TABLE "GastoRendicion" ADD COLUMN     "tipoRetencion" TEXT;
