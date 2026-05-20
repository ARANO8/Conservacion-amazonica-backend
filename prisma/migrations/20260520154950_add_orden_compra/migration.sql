-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" SERIAL NOT NULL,
    "codigoOrden" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proveedorNombre" TEXT NOT NULL,
    "proveedorDireccion" TEXT,
    "proveedorTelefono" TEXT,
    "lugarEntrega" TEXT,
    "formaPago" TEXT NOT NULL DEFAULT 'Transferencia bancaria',
    "garantia" TEXT NOT NULL DEFAULT 'N/A',
    "observaciones" TEXT,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "cuadroComparativoId" INTEGER,
    "usuarioEmisorId" INTEGER NOT NULL,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompraItem" (
    "id" SERIAL NOT NULL,
    "orden" INTEGER NOT NULL,
    "item" TEXT NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "unidad" TEXT,
    "detalle" TEXT,
    "precioUnitario" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sinCuadro" BOOLEAN NOT NULL DEFAULT false,
    "cuadroItemId" INTEGER,
    "ordenCompraId" INTEGER NOT NULL,

    CONSTRAINT "OrdenCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompra_codigoOrden_key" ON "OrdenCompra"("codigoOrden");

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_cuadroComparativoId_fkey" FOREIGN KEY ("cuadroComparativoId") REFERENCES "CuadroComparativo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_usuarioEmisorId_fkey" FOREIGN KEY ("usuarioEmisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_cuadroItemId_fkey" FOREIGN KEY ("cuadroItemId") REFERENCES "CuadroItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_ordenCompraId_fkey" FOREIGN KEY ("ordenCompraId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
