/*
  Warnings:

  - The values [APROBADA,OBSERVADA,RECHAZADA] on the enum `EstadoRendicion` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EstadoRendicion_new" AS ENUM ('PENDIENTE', 'APROBADO', 'OBSERVADO', 'RECHAZADO');
ALTER TABLE "Rendicion" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "Rendicion" ALTER COLUMN "estado" TYPE "EstadoRendicion_new" USING ("estado"::text::"EstadoRendicion_new");
ALTER TYPE "EstadoRendicion" RENAME TO "EstadoRendicion_old";
ALTER TYPE "EstadoRendicion_new" RENAME TO "EstadoRendicion";
DROP TYPE "EstadoRendicion_old";
ALTER TABLE "Rendicion" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
COMMIT;
