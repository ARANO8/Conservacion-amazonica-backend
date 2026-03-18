-- AlterTable
ALTER TABLE "GastoRendicion" ADD COLUMN     "concepto" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "montoBruto" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "montoImpuestos" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "montoNeto" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "partidaId" INTEGER,
ADD COLUMN     "proveedor" TEXT,
ADD COLUMN     "urlComprobante" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "monto" SET DEFAULT 0;

-- AddForeignKey
ALTER TABLE "GastoRendicion" ADD CONSTRAINT "GastoRendicion_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "SolicitudPresupuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
