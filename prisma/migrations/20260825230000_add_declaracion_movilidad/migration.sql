-- CreateTable
CREATE TABLE "DeclaracionMovilidad" (
    "id" SERIAL NOT NULL,
    "codigoDeclaracion" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "motivoActividad" TEXT NOT NULL,
    "proyectoPartida" TEXT NOT NULL,
    "lugarEmision" TEXT NOT NULL DEFAULT 'La Paz',
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "totalBruto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "retencion" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalLiquido" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "usuarioId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DeclaracionMovilidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleMovilidad" (
    "id" SERIAL NOT NULL,
    "declaracionId" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "origen" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "montoGastado" DECIMAL(12,2) NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "DetalleMovilidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeclaracionMovilidad_codigoDeclaracion_key" ON "DeclaracionMovilidad"("codigoDeclaracion");

-- CreateIndex
CREATE INDEX "DeclaracionMovilidad_usuarioId_idx" ON "DeclaracionMovilidad"("usuarioId");

-- CreateIndex
CREATE INDEX "DeclaracionMovilidad_deletedAt_idx" ON "DeclaracionMovilidad"("deletedAt");

-- CreateIndex
CREATE INDEX "DetalleMovilidad_declaracionId_idx" ON "DetalleMovilidad"("declaracionId");

-- AddForeignKey
ALTER TABLE "DeclaracionMovilidad" ADD CONSTRAINT "DeclaracionMovilidad_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleMovilidad" ADD CONSTRAINT "DetalleMovilidad_declaracionId_fkey" FOREIGN KEY ("declaracionId") REFERENCES "DeclaracionMovilidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
