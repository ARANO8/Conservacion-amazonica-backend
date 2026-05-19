-- CreateTable
CREATE TABLE "Cotizacion" (
    "id" SERIAL NOT NULL,
    "codigoCotizacion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proveedorNombre" TEXT NOT NULL,
    "proveedorTelefono" TEXT,
    "proveedorDireccion" TEXT,
    "proveedorCorreo" TEXT,
    "garantia" TEXT,
    "disponibilidad" TEXT,
    "duracionCotizacion" TEXT,
    "emiteFactura" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "usuarioEmisorId" INTEGER NOT NULL,

    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaCotizacion" (
    "id" SERIAL NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "unidad" TEXT,
    "detalle" TEXT NOT NULL,
    "precioUnitario" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "cotizacionId" INTEGER NOT NULL,

    CONSTRAINT "LineaCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cotizacion_codigoCotizacion_key" ON "Cotizacion"("codigoCotizacion");

-- AddForeignKey
ALTER TABLE "Cotizacion" ADD CONSTRAINT "Cotizacion_usuarioEmisorId_fkey" FOREIGN KEY ("usuarioEmisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaCotizacion" ADD CONSTRAINT "LineaCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
