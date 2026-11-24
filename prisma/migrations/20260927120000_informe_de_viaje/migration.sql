-- ANEXO 7: "Informe de Actividades" pasa a ser "Informe de Viaje". Se renombra
-- (no se recrea) para conservar los informes que ya existan, y se amplía con el
-- formato del anexo, el vínculo a su solicitud y la revisión del Director de
-- Programa.

-- CreateEnum
CREATE TYPE "EstadoInformeViaje" AS ENUM ('BORRADOR', 'ENVIADO', 'OBSERVADO', 'REVISADO');

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'INFORME_VIAJE_PENDIENTE';
ALTER TYPE "TipoNotificacion" ADD VALUE 'INFORME_VIAJE_REVISADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'INFORME_VIAJE_OBSERVADO';

-- Renombre de tablas, secuencias, índices y restricciones
ALTER TABLE "InformeActividades" RENAME TO "InformeViaje";
ALTER SEQUENCE "InformeActividades_id_seq" RENAME TO "InformeViaje_id_seq";
ALTER TABLE "InformeViaje" RENAME CONSTRAINT "InformeActividades_pkey" TO "InformeViaje_pkey";
ALTER TABLE "InformeViaje" RENAME CONSTRAINT "InformeActividades_usuarioId_fkey" TO "InformeViaje_usuarioId_fkey";
ALTER INDEX "InformeActividades_codigoInforme_key" RENAME TO "InformeViaje_codigoInforme_key";
ALTER INDEX "InformeActividades_usuarioId_idx" RENAME TO "InformeViaje_usuarioId_idx";
ALTER INDEX "InformeActividades_deletedAt_idx" RENAME TO "InformeViaje_deletedAt_idx";

ALTER TABLE "ActividadInforme" RENAME TO "ActividadInformeViaje";
ALTER SEQUENCE "ActividadInforme_id_seq" RENAME TO "ActividadInformeViaje_id_seq";
ALTER TABLE "ActividadInformeViaje" RENAME CONSTRAINT "ActividadInforme_pkey" TO "ActividadInformeViaje_pkey";
ALTER TABLE "ActividadInformeViaje" RENAME CONSTRAINT "ActividadInforme_informeId_fkey" TO "ActividadInformeViaje_informeId_fkey";
ALTER INDEX "ActividadInforme_informeId_idx" RENAME TO "ActividadInformeViaje_informeId_idx";

-- Campos del ANEXO 7. Los informes existentes reciben valores neutros: sin
-- motivo ni lugar, emitidos el día que se crearon.
ALTER TABLE "InformeViaje"
ADD COLUMN "motivoViaje" TEXT NOT NULL DEFAULT '',
ADD COLUMN "lugarViaje" TEXT NOT NULL DEFAULT '',
ADD COLUMN "lugarEmision" TEXT NOT NULL DEFAULT 'La Paz',
ADD COLUMN "fechaEmision" TIMESTAMP(3),
ADD COLUMN "estado" "EstadoInformeViaje" NOT NULL DEFAULT 'BORRADOR',
ADD COLUMN "observacion" TEXT,
ADD COLUMN "fechaRevision" TIMESTAMP(3),
ADD COLUMN "directorProgramaId" INTEGER,
ADD COLUMN "solicitudId" INTEGER;

UPDATE "InformeViaje" SET "fechaEmision" = "createdAt";
ALTER TABLE "InformeViaje" ALTER COLUMN "fechaEmision" SET NOT NULL;
ALTER TABLE "InformeViaje" ALTER COLUMN "motivoViaje" DROP DEFAULT;
ALTER TABLE "InformeViaje" ALTER COLUMN "lugarViaje" DROP DEFAULT;

ALTER TABLE "ActividadInformeViaje" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0;

-- Historial y notificaciones del informe
ALTER TABLE "HistorialAprobacion" ADD COLUMN "informeViajeId" INTEGER;
ALTER TABLE "Notificacion" ADD COLUMN "informeViajeId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "InformeViaje_solicitudId_key" ON "InformeViaje"("solicitudId");
CREATE INDEX "InformeViaje_directorProgramaId_idx" ON "InformeViaje"("directorProgramaId");
CREATE INDEX "InformeViaje_estado_idx" ON "InformeViaje"("estado");

-- AddForeignKey
ALTER TABLE "HistorialAprobacion" ADD CONSTRAINT "HistorialAprobacion_informeViajeId_fkey" FOREIGN KEY ("informeViajeId") REFERENCES "InformeViaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_informeViajeId_fkey" FOREIGN KEY ("informeViajeId") REFERENCES "InformeViaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InformeViaje" ADD CONSTRAINT "InformeViaje_directorProgramaId_fkey" FOREIGN KEY ("directorProgramaId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InformeViaje" ADD CONSTRAINT "InformeViaje_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE SET NULL ON UPDATE CASCADE;
