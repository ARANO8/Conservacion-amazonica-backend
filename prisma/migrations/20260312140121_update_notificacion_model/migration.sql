/*
  Warnings:

  - You are about to drop the column `fechaCreacion` on the `Notificacion` table. All the data in the column will be lost.
  - You are about to drop the column `leido` on the `Notificacion` table. All the data in the column will be lost.
  - Added the required column `titulo` to the `Notificacion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Notificacion` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('SOLICITUD_ASIGNADA', 'SOLICITUD_DERIVADA', 'SOLICITUD_APROBADA', 'SOLICITUD_OBSERVADA', 'RENDICION_PENDIENTE');

-- DropForeignKey
ALTER TABLE "Notificacion" DROP CONSTRAINT "Notificacion_usuarioId_fkey";

-- DropForeignKey
ALTER TABLE "Notificacion" DROP CONSTRAINT "Notificacion_solicitudId_fkey";

-- AlterTable
ALTER TABLE "Notificacion" DROP COLUMN "fechaCreacion",
DROP COLUMN "leido",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "leida" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipo" "TipoNotificacion" NOT NULL DEFAULT 'SOLICITUD_ASIGNADA',
ADD COLUMN     "titulo" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "urlDestino" TEXT;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE SET NULL ON UPDATE CASCADE;
