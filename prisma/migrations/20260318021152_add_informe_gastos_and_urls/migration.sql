-- AlterTable
ALTER TABLE "Rendicion" ADD COLUMN     "urlCotizaciones" TEXT[],
ADD COLUMN     "urlCuadroComparativo" TEXT;

-- CreateTable
CREATE TABLE "InformeGastos" (
    "id" SERIAL NOT NULL,
    "rendicionId" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InformeGastos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActividadInforme" (
    "id" SERIAL NOT NULL,
    "informeId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "lugar" TEXT NOT NULL,
    "personaInstitucion" TEXT NOT NULL,
    "actividadesRealizadas" TEXT NOT NULL,

    CONSTRAINT "ActividadInforme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InformeGastos_rendicionId_key" ON "InformeGastos"("rendicionId");

-- AddForeignKey
ALTER TABLE "InformeGastos" ADD CONSTRAINT "InformeGastos_rendicionId_fkey" FOREIGN KEY ("rendicionId") REFERENCES "Rendicion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActividadInforme" ADD CONSTRAINT "ActividadInforme_informeId_fkey" FOREIGN KEY ("informeId") REFERENCES "InformeGastos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
