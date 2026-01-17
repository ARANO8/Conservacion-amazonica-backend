/*
  Warnings:

  - The values [EN_SOLICITUD,RECHAZADO] on the enum `EstadoSolicitud` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `planificacionId` on the `Solicitud` table. All the data in the column will be lost.
  - You are about to drop the column `usuarioAprobadorId` on the `Solicitud` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nombre]` on the table `Concepto` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[codigoSolicitud]` on the table `Solicitud` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[codigo]` on the table `TipoGasto` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `solicitudId` to the `Planificacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codigoSolicitud` to the `Solicitud` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codigo` to the `TipoGasto` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EstadoSolicitud_new" AS ENUM ('PENDIENTE', 'OBSERVADO', 'DESEMBOLSADO', 'EJECUTADO');
ALTER TABLE "Solicitud" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "Solicitud" ALTER COLUMN "estado" TYPE "EstadoSolicitud_new" USING ("estado"::text::"EstadoSolicitud_new");
ALTER TYPE "EstadoSolicitud" RENAME TO "EstadoSolicitud_old";
ALTER TYPE "EstadoSolicitud_new" RENAME TO "EstadoSolicitud";
DROP TYPE "EstadoSolicitud_old";
ALTER TABLE "Solicitud" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
COMMIT;

-- DropForeignKey
ALTER TABLE "Solicitud" DROP CONSTRAINT "Solicitud_planificacionId_fkey";

-- DropForeignKey
ALTER TABLE "Solicitud" DROP CONSTRAINT "Solicitud_usuarioAprobadorId_fkey";

-- AlterTable
ALTER TABLE "Planificacion" ADD COLUMN     "solicitudId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Solicitud" DROP COLUMN "planificacionId",
DROP COLUMN "usuarioAprobadorId",
ADD COLUMN     "aprobadorId" INTEGER,
ADD COLUMN     "codigoSolicitud" TEXT NOT NULL,
ADD COLUMN     "observacion" TEXT,
ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';

-- AlterTable
ALTER TABLE "TipoGasto" ADD COLUMN     "codigo" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "NominaTerceros" (
    "id" SERIAL NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "ci" TEXT NOT NULL,
    "solicitudId" INTEGER NOT NULL,

    CONSTRAINT "NominaTerceros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Concepto_nombre_key" ON "Concepto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Solicitud_codigoSolicitud_key" ON "Solicitud"("codigoSolicitud");

-- CreateIndex
CREATE UNIQUE INDEX "TipoGasto_codigo_key" ON "TipoGasto"("codigo");

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_aprobadorId_fkey" FOREIGN KEY ("aprobadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planificacion" ADD CONSTRAINT "Planificacion_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominaTerceros" ADD CONSTRAINT "NominaTerceros_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
