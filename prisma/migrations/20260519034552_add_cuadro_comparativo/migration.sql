-- CreateEnum
CREATE TYPE "EstadoCuadroComparativo" AS ENUM ('BORRADOR', 'EN_VALIDACION', 'OBSERVADO', 'EN_REVISION', 'APROBADO');

-- CreateTable
CREATE TABLE "CuadroComparativo" (
    "id" SERIAL NOT NULL,
    "codigoCuadro" TEXT NOT NULL,
    "lugarFecha" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoCuadroComparativo" NOT NULL DEFAULT 'BORRADOR',
    "totalRecomendado" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "usuarioEmisorId" INTEGER NOT NULL,
    "cotizacionRecomendadaId" INTEGER,

    CONSTRAINT "CuadroComparativo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuadroCotizacion" (
    "id" SERIAL NOT NULL,
    "orden" INTEGER NOT NULL,
    "proveedorNombre" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cuadroId" INTEGER NOT NULL,
    "cotizacionId" INTEGER NOT NULL,

    CONSTRAINT "CuadroCotizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuadroItem" (
    "id" SERIAL NOT NULL,
    "orden" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(10,2) NOT NULL,
    "unidad" TEXT,
    "cuadroId" INTEGER NOT NULL,
    "cotizacionGanadoraId" INTEGER,

    CONSTRAINT "CuadroItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuadroPrecio" (
    "id" SERIAL NOT NULL,
    "precioUnitario" DECIMAL(12,2),
    "total" DECIMAL(12,2),
    "noMenciona" BOOLEAN NOT NULL DEFAULT false,
    "cuadroItemId" INTEGER NOT NULL,
    "cuadroCotizacionId" INTEGER NOT NULL,

    CONSTRAINT "CuadroPrecio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuadroComparativo_codigoCuadro_key" ON "CuadroComparativo"("codigoCuadro");

-- CreateIndex
CREATE UNIQUE INDEX "CuadroPrecio_cuadroItemId_cuadroCotizacionId_key" ON "CuadroPrecio"("cuadroItemId", "cuadroCotizacionId");

-- AddForeignKey
ALTER TABLE "CuadroComparativo" ADD CONSTRAINT "CuadroComparativo_usuarioEmisorId_fkey" FOREIGN KEY ("usuarioEmisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuadroComparativo" ADD CONSTRAINT "CuadroComparativo_cotizacionRecomendadaId_fkey" FOREIGN KEY ("cotizacionRecomendadaId") REFERENCES "CuadroCotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuadroCotizacion" ADD CONSTRAINT "CuadroCotizacion_cuadroId_fkey" FOREIGN KEY ("cuadroId") REFERENCES "CuadroComparativo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuadroCotizacion" ADD CONSTRAINT "CuadroCotizacion_cotizacionId_fkey" FOREIGN KEY ("cotizacionId") REFERENCES "Cotizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuadroItem" ADD CONSTRAINT "CuadroItem_cuadroId_fkey" FOREIGN KEY ("cuadroId") REFERENCES "CuadroComparativo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuadroItem" ADD CONSTRAINT "CuadroItem_cotizacionGanadoraId_fkey" FOREIGN KEY ("cotizacionGanadoraId") REFERENCES "CuadroCotizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuadroPrecio" ADD CONSTRAINT "CuadroPrecio_cuadroItemId_fkey" FOREIGN KEY ("cuadroItemId") REFERENCES "CuadroItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuadroPrecio" ADD CONSTRAINT "CuadroPrecio_cuadroCotizacionId_fkey" FOREIGN KEY ("cuadroCotizacionId") REFERENCES "CuadroCotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
