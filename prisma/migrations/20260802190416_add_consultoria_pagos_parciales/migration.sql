-- AlterTable
ALTER TABLE "GastoCompra" ADD COLUMN     "it" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "iva" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "montoPresupuestado" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'FACTURA';

-- Backfill: los gastos de compra existentes no llevaban retencion, por lo que
-- su bruto es igual a su total. Sin esto afectarian al POA por 0.
UPDATE "GastoCompra" SET "montoPresupuestado" = "total";

-- CreateTable
CREATE TABLE "PagoParcial" (
    "id" SERIAL NOT NULL,
    "numero" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "descripcion" VARCHAR(500),
    "gastoCompraId" INTEGER NOT NULL,

    CONSTRAINT "PagoParcial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagoParcial_gastoCompraId_idx" ON "PagoParcial"("gastoCompraId");

-- AddForeignKey
ALTER TABLE "PagoParcial" ADD CONSTRAINT "PagoParcial_gastoCompraId_fkey" FOREIGN KEY ("gastoCompraId") REFERENCES "GastoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
