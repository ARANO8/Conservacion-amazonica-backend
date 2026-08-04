/*
  Warnings:

  - You are about to drop the `InformeGastos` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ActividadInforme" DROP CONSTRAINT "ActividadInforme_informeId_fkey";

-- DropForeignKey
ALTER TABLE "InformeGastos" DROP CONSTRAINT "InformeGastos_rendicionId_fkey";

-- DropTable
DROP TABLE "InformeGastos";

-- CreateTable
CREATE TABLE "InformeActividades" (
    "id" SERIAL NOT NULL,
    "codigoInforme" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InformeActividades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InformeActividades_codigoInforme_key" ON "InformeActividades"("codigoInforme");

-- CreateIndex
CREATE INDEX "InformeActividades_usuarioId_idx" ON "InformeActividades"("usuarioId");

-- CreateIndex
CREATE INDEX "InformeActividades_deletedAt_idx" ON "InformeActividades"("deletedAt");

-- CreateIndex
CREATE INDEX "ActividadInforme_informeId_idx" ON "ActividadInforme"("informeId");

-- AddForeignKey
ALTER TABLE "InformeActividades" ADD CONSTRAINT "InformeActividades_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActividadInforme" ADD CONSTRAINT "ActividadInforme_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "InformeActividades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
