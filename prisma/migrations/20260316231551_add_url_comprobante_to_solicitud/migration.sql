/*
  Warnings:

  - You are about to alter the column `cantidadUnitaria` on the `Hospedaje` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `costoTotal` on the `Hospedaje` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `iva` on the `Hospedaje` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.
  - You are about to alter the column `it` on the `Hospedaje` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "Hospedaje" ALTER COLUMN "cantidadUnitaria" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "costoTotal" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "iva" SET DATA TYPE DECIMAL(10,2),
ALTER COLUMN "it" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Notificacion" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN     "urlComprobante" TEXT;
