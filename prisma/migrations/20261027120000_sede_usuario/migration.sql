-- CreateEnum
CREATE TYPE "Sede" AS ENUM ('LA_PAZ', 'TRINIDAD', 'COBIJA');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "sede" "Sede";

