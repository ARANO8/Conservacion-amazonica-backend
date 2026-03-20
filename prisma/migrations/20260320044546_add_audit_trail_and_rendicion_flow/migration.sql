/*
  Warnings:

  - You are about to drop the column `fechaAccion` on the `HistorialAprobacion` table. All the data in the column will be lost.
  - You are about to drop the column `usuarioActorId` on the `HistorialAprobacion` table. All the data in the column will be lost.
  - Added the required column `usuarioId` to the `HistorialAprobacion` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `accion` on the `HistorialAprobacion` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TipoAccionHistorial" AS ENUM ('CREADO', 'APROBADO', 'OBSERVADO', 'DERIVADO', 'RECHAZADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoRendicion" ADD VALUE 'APROBADO';
ALTER TYPE "EstadoRendicion" ADD VALUE 'OBSERVADO';
ALTER TYPE "EstadoRendicion" ADD VALUE 'RECHAZADO';

-- DropForeignKey
ALTER TABLE "HistorialAprobacion" DROP CONSTRAINT "HistorialAprobacion_solicitudId_fkey";

-- DropForeignKey
ALTER TABLE "HistorialAprobacion" DROP CONSTRAINT "HistorialAprobacion_usuarioActorId_fkey";

-- AlterTable
ALTER TABLE "HistorialAprobacion" DROP COLUMN "fechaAccion",
DROP COLUMN "usuarioActorId",
ADD COLUMN     "derivadoAId" INTEGER,
ADD COLUMN     "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "rendicionId" INTEGER,
ADD COLUMN     "usuarioId" INTEGER NOT NULL,
DROP COLUMN "accion",
ADD COLUMN     "accion" "TipoAccionHistorial" NOT NULL,
ALTER COLUMN "solicitudId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Rendicion" ADD COLUMN     "aprobadorActualId" INTEGER;

-- DropEnum
DROP TYPE "AccionHistorial";

-- AddForeignKey
ALTER TABLE "HistorialAprobacion" ADD CONSTRAINT "HistorialAprobacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialAprobacion" ADD CONSTRAINT "HistorialAprobacion_derivadoAId_fkey" FOREIGN KEY ("derivadoAId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialAprobacion" ADD CONSTRAINT "HistorialAprobacion_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialAprobacion" ADD CONSTRAINT "HistorialAprobacion_rendicionId_fkey" FOREIGN KEY ("rendicionId") REFERENCES "Rendicion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rendicion" ADD CONSTRAINT "Rendicion_aprobadorActualId_fkey" FOREIGN KEY ("aprobadorActualId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
