/*
  Warnings:

  - You are about to drop the column `urlCotizaciones` on the `Rendicion` table. All the data in the column will be lost.
  - You are about to drop the column `urlCuadroComparativo` on the `Rendicion` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Rendicion" DROP COLUMN "urlCotizaciones",
DROP COLUMN "urlCuadroComparativo";

-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN     "urlCotizaciones" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "urlCuadroComparativo" TEXT;
