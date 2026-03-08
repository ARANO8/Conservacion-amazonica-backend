/*
  Warnings:

  - You are about to drop the column `planificacionId` on the `Viatico` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Viatico" DROP CONSTRAINT "Viatico_planificacionId_fkey";

-- AlterTable
ALTER TABLE "Viatico" DROP COLUMN "planificacionId";

-- CreateTable
CREATE TABLE "Hospedaje" (
    "id" SERIAL NOT NULL,
    "region" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "personas" INTEGER NOT NULL,
    "noches" INTEGER NOT NULL,
    "cantidadUnitaria" DOUBLE PRECISION NOT NULL,
    "costoTotal" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL,
    "it" DOUBLE PRECISION NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "poaId" INTEGER NOT NULL,

    CONSTRAINT "Hospedaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PlanificacionToViatico" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PlanificacionToViatico_AB_unique" ON "_PlanificacionToViatico"("A", "B");

-- CreateIndex
CREATE INDEX "_PlanificacionToViatico_B_index" ON "_PlanificacionToViatico"("B");

-- AddForeignKey
ALTER TABLE "Hospedaje" ADD CONSTRAINT "Hospedaje_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hospedaje" ADD CONSTRAINT "Hospedaje_poaId_fkey" FOREIGN KEY ("poaId") REFERENCES "Poa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanificacionToViatico" ADD CONSTRAINT "_PlanificacionToViatico_A_fkey" FOREIGN KEY ("A") REFERENCES "Planificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanificacionToViatico" ADD CONSTRAINT "_PlanificacionToViatico_B_fkey" FOREIGN KEY ("B") REFERENCES "Viatico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
