/*
  Warnings:

  - You are about to drop the column `estado` on the `SolicitudPresupuesto` table. All the data in the column will be lost.
  - You are about to drop the column `usuarioId` on the `SolicitudPresupuesto` table. All the data in the column will be lost.
  - Made the column `solicitudId` on table `SolicitudPresupuesto` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "SolicitudPresupuesto" DROP CONSTRAINT "SolicitudPresupuesto_solicitudId_fkey";

-- DropForeignKey
ALTER TABLE "SolicitudPresupuesto" DROP CONSTRAINT "SolicitudPresupuesto_usuarioId_fkey";

-- AlterTable
ALTER TABLE "SolicitudPresupuesto" DROP COLUMN "estado",
DROP COLUMN "usuarioId",
ALTER COLUMN "solicitudId" SET NOT NULL;

-- DropEnum
DROP TYPE "EstadoReserva";

-- AddForeignKey
ALTER TABLE "SolicitudPresupuesto" ADD CONSTRAINT "SolicitudPresupuesto_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
