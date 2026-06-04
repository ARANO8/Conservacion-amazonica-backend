-- CreateEnum
CREATE TYPE "TipoSolicitud" AS ENUM ('VIAJE', 'COMPRA_SERVICIO');

-- CreateEnum
CREATE TYPE "TipoCotizacion" AS ENUM ('PROPIA', 'EXTERNA');

-- AlterTable
ALTER TABLE "Cotizacion" ADD COLUMN     "adjuntoUrl" TEXT,
ADD COLUMN     "tipo" "TipoCotizacion" NOT NULL DEFAULT 'PROPIA';

-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN     "banco" VARCHAR(100),
ADD COLUMN     "chequeANombreDe" VARCHAR(200),
ADD COLUMN     "fechaDesembolso" TIMESTAMP(3),
ADD COLUMN     "proyecto" VARCHAR(200),
ADD COLUMN     "tipo" "TipoSolicitud" NOT NULL DEFAULT 'VIAJE';

-- CreateTable
CREATE TABLE "GastoCompra" (
    "id" SERIAL NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "uso" VARCHAR(100),
    "costoUnitario" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "solicitudPresupuestoId" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GastoCompra_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GastoCompra" ADD CONSTRAINT "GastoCompra_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoCompra" ADD CONSTRAINT "GastoCompra_solicitudPresupuestoId_fkey" FOREIGN KEY ("solicitudPresupuestoId") REFERENCES "SolicitudPresupuesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
