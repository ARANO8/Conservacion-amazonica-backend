/*
  Warnings:

  - You are about to alter the column `dias` on the `Viatico` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.

*/
-- AlterTable
ALTER TABLE "Viatico" ALTER COLUMN "dias" SET DATA TYPE DECIMAL(5,2);
