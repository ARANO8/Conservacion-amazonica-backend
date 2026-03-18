/*
  Warnings:

  - You are about to drop the column `saldoADevolver` on the `Rendicion` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EstadoRendicion" AS ENUM ('PENDIENTE', 'APROBADA', 'OBSERVADA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "Rendicion" DROP COLUMN "saldoADevolver",
ADD COLUMN     "estado" "EstadoRendicion" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "saldoLiquido" DECIMAL(10,2) NOT NULL DEFAULT 0,
ALTER COLUMN "montoRespaldado" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "GastoRendicion" (
    "id" SERIAL NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL,
    "nroDocumento" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "detalle" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "rendicionId" INTEGER NOT NULL,

    CONSTRAINT "GastoRendicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeclaracionJurada" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "detalle" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "rendicionId" INTEGER NOT NULL,

    CONSTRAINT "DeclaracionJurada_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GastoRendicion" ADD CONSTRAINT "GastoRendicion_rendicionId_fkey" FOREIGN KEY ("rendicionId") REFERENCES "Rendicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeclaracionJurada" ADD CONSTRAINT "DeclaracionJurada_rendicionId_fkey" FOREIGN KEY ("rendicionId") REFERENCES "Rendicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
