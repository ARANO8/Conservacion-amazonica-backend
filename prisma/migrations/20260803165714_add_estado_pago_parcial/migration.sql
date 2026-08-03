/*
  Warnings:

  - Added the required column `updatedAt` to the `PagoParcial` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EstadoPagoParcial" AS ENUM ('PLANIFICADO', 'SOLICITADO', 'APROBADO', 'PAGADO');

-- AlterEnum
ALTER TYPE "EstadoSolicitud" ADD VALUE 'EN_EJECUCION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'PAGO_PENDIENTE_APROBACION';
ALTER TYPE "TipoNotificacion" ADD VALUE 'PAGO_REALIZADO';

-- AlterTable
ALTER TABLE "PagoParcial" ADD COLUMN     "aprobadorId" INTEGER,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "estado" "EstadoPagoParcial" NOT NULL DEFAULT 'PLANIFICADO',
ADD COLUMN     "fechaPagoReal" TIMESTAMP(3),
ADD COLUMN     "pagadoPorId" INTEGER,
ADD COLUMN     "solicitadoPorId" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "urlComprobante" TEXT,
ADD COLUMN     "urlInforme" TEXT;

-- CreateIndex
CREATE INDEX "PagoParcial_estado_idx" ON "PagoParcial"("estado");

-- CreateIndex
CREATE INDEX "PagoParcial_aprobadorId_idx" ON "PagoParcial"("aprobadorId");

-- AddForeignKey
ALTER TABLE "PagoParcial" ADD CONSTRAINT "PagoParcial_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoParcial" ADD CONSTRAINT "PagoParcial_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoParcial" ADD CONSTRAINT "PagoParcial_pagadoPorId_fkey" FOREIGN KEY ("pagadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
