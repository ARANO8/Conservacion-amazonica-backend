/*
  Warnings:

  - You are about to drop the `NominaTerceros` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Poa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Rendicion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Solicitud` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Gasto" DROP CONSTRAINT "Gasto_solicitudId_fkey";

-- DropForeignKey
ALTER TABLE "Gasto" DROP CONSTRAINT "Gasto_solicitudPresupuestoId_fkey";

-- DropForeignKey
ALTER TABLE "GastoCompra" DROP CONSTRAINT "GastoCompra_solicitudId_fkey";

-- DropForeignKey
ALTER TABLE "GastoCompra" DROP CONSTRAINT "GastoCompra_solicitudPresupuestoId_fkey";

-- DropForeignKey
ALTER TABLE "NominaTerceros" DROP CONSTRAINT "NominaTerceros_solicitudId_fkey";

-- DropForeignKey
ALTER TABLE "PersonaExterna" DROP CONSTRAINT "PersonaExterna_solicitudId_fkey";

-- DropForeignKey
ALTER TABLE "Planificacion" DROP CONSTRAINT "Planificacion_solicitudId_fkey";

-- DropForeignKey
ALTER TABLE "Rendicion" DROP CONSTRAINT "Rendicion_solicitudId_fkey";

-- DropForeignKey
ALTER TABLE "SolicitudPresupuesto" DROP CONSTRAINT "SolicitudPresupuesto_solicitudId_fkey";

-- DropForeignKey
ALTER TABLE "Viatico" DROP CONSTRAINT "Viatico_solicitudId_fkey";

-- DropForeignKey
ALTER TABLE "Viatico" DROP CONSTRAINT "Viatico_solicitudPresupuestoId_fkey";

-- AlterTable
ALTER TABLE "Poa" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Rendicion" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "NominaTerceros";

-- AddForeignKey
ALTER TABLE "Rendicion" ADD CONSTRAINT "Rendicion_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudPresupuesto" ADD CONSTRAINT "SolicitudPresupuesto_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planificacion" ADD CONSTRAINT "Planificacion_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viatico" ADD CONSTRAINT "Viatico_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viatico" ADD CONSTRAINT "Viatico_solicitudPresupuestoId_fkey" FOREIGN KEY ("solicitudPresupuestoId") REFERENCES "SolicitudPresupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_solicitudPresupuestoId_fkey" FOREIGN KEY ("solicitudPresupuestoId") REFERENCES "SolicitudPresupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonaExterna" ADD CONSTRAINT "PersonaExterna_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCompra" ADD CONSTRAINT "GastoCompra_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCompra" ADD CONSTRAINT "GastoCompra_solicitudPresupuestoId_fkey" FOREIGN KEY ("solicitudPresupuestoId") REFERENCES "SolicitudPresupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
