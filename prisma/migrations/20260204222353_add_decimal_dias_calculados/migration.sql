/*
  Warnings:

  - You are about to alter the column `diasCalculados` on the `Planificacion` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.

*/
-- AlterTable
ALTER TABLE "Planificacion" ALTER COLUMN "diasCalculados" SET DATA TYPE DECIMAL(5,2);
