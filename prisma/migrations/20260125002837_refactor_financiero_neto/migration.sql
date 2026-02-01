/*
  Warnings:

  - You are about to drop the column `grupoId` on the `Gasto` table. All the data in the column will be lost.
  - You are about to drop the column `liquidoPagable` on the `Gasto` table. All the data in the column will be lost.
  - You are about to drop the column `partidaId` on the `Gasto` table. All the data in the column will be lost.
  - You are about to drop the column `totalBs` on the `Gasto` table. All the data in the column will be lost.
  - You are about to drop the column `liquidoPagable` on the `Solicitud` table. All the data in the column will be lost.
  - You are about to drop the column `montoTotal` on the `Solicitud` table. All the data in the column will be lost.
  - You are about to drop the column `poaId` on the `Solicitud` table. All the data in the column will be lost.
  - You are about to drop the column `liquidoPagable` on the `Viatico` table. All the data in the column will be lost.
  - You are about to drop the column `totalBs` on the `Viatico` table. All the data in the column will be lost.
  - Added the required column `montoNeto` to the `Gasto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `montoPresupuestado` to the `Gasto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `solicitudPresupuestoId` to the `Gasto` table without a default value. This is not possible if the table is not empty.
  - Added the required column `montoNeto` to the `Viatico` table without a default value. This is not possible if the table is not empty.
  - Added the required column `montoPresupuestado` to the `Viatico` table without a default value. This is not possible if the table is not empty.
  - Added the required column `solicitudPresupuestoId` to the `Viatico` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('RESERVADO', 'CONFIRMADO');

-- DropForeignKey
ALTER TABLE "Gasto" DROP CONSTRAINT "Gasto_grupoId_fkey";

-- DropForeignKey
ALTER TABLE "Gasto" DROP CONSTRAINT "Gasto_partidaId_fkey";

-- DropForeignKey
ALTER TABLE "Solicitud" DROP CONSTRAINT "Solicitud_poaId_fkey";

-- DropIndex
DROP INDEX "Solicitud_poaId_key";

-- AlterTable
ALTER TABLE "Gasto" DROP COLUMN "grupoId",
DROP COLUMN "liquidoPagable",
DROP COLUMN "partidaId",
DROP COLUMN "totalBs",
ADD COLUMN     "detalle" TEXT,
ADD COLUMN     "montoNeto" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "montoPresupuestado" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "solicitudPresupuestoId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Solicitud" DROP COLUMN "liquidoPagable",
DROP COLUMN "montoTotal",
DROP COLUMN "poaId",
ADD COLUMN     "montoTotalNeto" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "montoTotalPresupuestado" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Viatico" DROP COLUMN "liquidoPagable",
DROP COLUMN "totalBs",
ADD COLUMN     "cantidadPersonas" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "montoNeto" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "montoPresupuestado" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "solicitudPresupuestoId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "SolicitudPresupuesto" (
    "id" SERIAL NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'RESERVADO',
    "expiresAt" TIMESTAMP(3),
    "subtotalNeto" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotalPresupuestado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "solicitudId" INTEGER,
    "usuarioId" INTEGER,
    "poaId" INTEGER NOT NULL,

    CONSTRAINT "SolicitudPresupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudPresupuesto_solicitudId_poaId_key" ON "SolicitudPresupuesto"("solicitudId", "poaId");

-- AddForeignKey
ALTER TABLE "SolicitudPresupuesto" ADD CONSTRAINT "SolicitudPresupuesto_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudPresupuesto" ADD CONSTRAINT "SolicitudPresupuesto_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudPresupuesto" ADD CONSTRAINT "SolicitudPresupuesto_poaId_fkey" FOREIGN KEY ("poaId") REFERENCES "Poa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viatico" ADD CONSTRAINT "Viatico_solicitudPresupuestoId_fkey" FOREIGN KEY ("solicitudPresupuestoId") REFERENCES "SolicitudPresupuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_solicitudPresupuestoId_fkey" FOREIGN KEY ("solicitudPresupuestoId") REFERENCES "SolicitudPresupuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
