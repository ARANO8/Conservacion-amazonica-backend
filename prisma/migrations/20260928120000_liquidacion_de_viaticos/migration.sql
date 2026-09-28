-- ANEXO 5: Liquidación de Viáticos de un viaje, una hoja por persona, y C.I.
-- del usuario. Migración solo aditiva.

-- CreateEnum
CREATE TYPE "EstadoLiquidacionViaticos" AS ENUM ('BORRADOR', 'ENVIADO', 'OBSERVADO', 'REVISADO');

-- AlterEnum


ALTER TYPE "TipoNotificacion" ADD VALUE 'LIQUIDACION_VIATICOS_PENDIENTE';
ALTER TYPE "TipoNotificacion" ADD VALUE 'LIQUIDACION_VIATICOS_REVISADA';
ALTER TYPE "TipoNotificacion" ADD VALUE 'LIQUIDACION_VIATICOS_OBSERVADA';

-- AlterTable
ALTER TABLE "GastoRendicion" ADD COLUMN     "hojaLiquidacionId" INTEGER;

-- AlterTable
ALTER TABLE "HistorialAprobacion" ADD COLUMN     "liquidacionViaticosId" INTEGER;

-- AlterTable
ALTER TABLE "Notificacion" ADD COLUMN     "liquidacionViaticosId" INTEGER;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "ci" TEXT;

-- CreateTable
CREATE TABLE "LiquidacionViaticos" (
    "id" SERIAL NOT NULL,
    "codigoLiquidacion" TEXT NOT NULL,
    "lugarEmision" TEXT NOT NULL DEFAULT 'La Paz',
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "tipoCambio" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoLiquidacionViaticos" NOT NULL DEFAULT 'BORRADOR',
    "observacion" TEXT,
    "fechaRevision" TIMESTAMP(3),
    "usuarioId" INTEGER NOT NULL,
    "directorProgramaId" INTEGER,
    "solicitudId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LiquidacionViaticos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HojaLiquidacion" (
    "id" SERIAL NOT NULL,
    "liquidacionId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "usuarioId" INTEGER NOT NULL,
    "cargo" TEXT NOT NULL,
    "ci" TEXT NOT NULL DEFAULT '',
    "sede" TEXT NOT NULL DEFAULT 'La Paz',
    "via" TEXT NOT NULL DEFAULT '',
    "escala" TEXT NOT NULL DEFAULT '',
    "motivoViaje" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "fechaSalida" TIMESTAMP(3) NOT NULL,
    "fechaRetorno" TIMESTAMP(3) NOT NULL,
    "totalLiquido" DECIMAL(10,2) NOT NULL,
    "totalBruto" DECIMAL(10,2) NOT NULL,
    "rcIva" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "HojaLiquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilaLiquidacion" (
    "id" SERIAL NOT NULL,
    "hojaId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "conceptoId" INTEGER NOT NULL,
    "porcentaje" INTEGER NOT NULL DEFAULT 100,
    "dias" DECIMAL(5,1) NOT NULL,
    "tarifaLiquida" DECIMAL(10,2) NOT NULL,
    "totalLiquido" DECIMAL(10,2) NOT NULL,
    "totalBruto" DECIMAL(10,2) NOT NULL,
    "solicitudPresupuestoId" INTEGER,

    CONSTRAINT "FilaLiquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiquidacionViaticos_codigoLiquidacion_key" ON "LiquidacionViaticos"("codigoLiquidacion");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidacionViaticos_solicitudId_key" ON "LiquidacionViaticos"("solicitudId");

-- CreateIndex
CREATE INDEX "LiquidacionViaticos_usuarioId_idx" ON "LiquidacionViaticos"("usuarioId");

-- CreateIndex
CREATE INDEX "LiquidacionViaticos_directorProgramaId_idx" ON "LiquidacionViaticos"("directorProgramaId");

-- CreateIndex
CREATE INDEX "LiquidacionViaticos_estado_idx" ON "LiquidacionViaticos"("estado");

-- CreateIndex
CREATE INDEX "LiquidacionViaticos_deletedAt_idx" ON "LiquidacionViaticos"("deletedAt");

-- CreateIndex
CREATE INDEX "HojaLiquidacion_usuarioId_idx" ON "HojaLiquidacion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "HojaLiquidacion_liquidacionId_usuarioId_key" ON "HojaLiquidacion"("liquidacionId", "usuarioId");

-- CreateIndex
CREATE INDEX "FilaLiquidacion_hojaId_idx" ON "FilaLiquidacion"("hojaId");

-- CreateIndex
CREATE INDEX "GastoRendicion_hojaLiquidacionId_idx" ON "GastoRendicion"("hojaLiquidacionId");

-- AddForeignKey
ALTER TABLE "HistorialAprobacion" ADD CONSTRAINT "HistorialAprobacion_liquidacionViaticosId_fkey" FOREIGN KEY ("liquidacionViaticosId") REFERENCES "LiquidacionViaticos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_liquidacionViaticosId_fkey" FOREIGN KEY ("liquidacionViaticosId") REFERENCES "LiquidacionViaticos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionViaticos" ADD CONSTRAINT "LiquidacionViaticos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionViaticos" ADD CONSTRAINT "LiquidacionViaticos_directorProgramaId_fkey" FOREIGN KEY ("directorProgramaId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionViaticos" ADD CONSTRAINT "LiquidacionViaticos_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HojaLiquidacion" ADD CONSTRAINT "HojaLiquidacion_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "LiquidacionViaticos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HojaLiquidacion" ADD CONSTRAINT "HojaLiquidacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilaLiquidacion" ADD CONSTRAINT "FilaLiquidacion_hojaId_fkey" FOREIGN KEY ("hojaId") REFERENCES "HojaLiquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilaLiquidacion" ADD CONSTRAINT "FilaLiquidacion_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "Concepto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilaLiquidacion" ADD CONSTRAINT "FilaLiquidacion_solicitudPresupuestoId_fkey" FOREIGN KEY ("solicitudPresupuestoId") REFERENCES "SolicitudPresupuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoRendicion" ADD CONSTRAINT "GastoRendicion_hojaLiquidacionId_fkey" FOREIGN KEY ("hojaLiquidacionId") REFERENCES "HojaLiquidacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

