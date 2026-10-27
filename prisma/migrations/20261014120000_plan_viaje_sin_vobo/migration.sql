-- Spec 023: el Plan de Viaje (ANEXO 1) deja de pasar por el VoBo del Director
-- de Programa. Lo firma en papel el Director Ejecutivo.

-- 1. Los planes que esperaban un VoBo que ya no existe se borran de verdad.
--    Ninguno puede respaldar una solicitud (la API exigía APROBADO), pero se
--    comprueba igual. Sus actividades, participantes, viáticos (N:M) y
--    terceros caen en cascada; historial y notificaciones quedarían huérfanos
--    (SET NULL), así que se borran antes.
CREATE TEMP TABLE "_planes_enviados" AS
SELECT p.id
FROM "PlanViaje" p
WHERE p.estado = 'ENVIADO'
  AND NOT EXISTS (SELECT 1 FROM "Solicitud" s WHERE s."planViajeId" = p.id);

DELETE FROM "HistorialAprobacion" WHERE "planViajeId" IN (SELECT id FROM "_planes_enviados");
DELETE FROM "Notificacion" WHERE "planViajeId" IN (SELECT id FROM "_planes_enviados");
DELETE FROM "PlanViaje" WHERE id IN (SELECT id FROM "_planes_enviados");

DROP TABLE "_planes_enviados";

-- 2. Avisos de envíos, VoBos y observaciones de planes: ya no existen, y
--    Postgres no deja quitar los valores del enum mientras haya filas que los usen.
DELETE FROM "Notificacion"
WHERE tipo IN ('PLAN_VIAJE_PENDIENTE', 'PLAN_VIAJE_APROBADO', 'PLAN_VIAJE_OBSERVADO');

-- AlterEnum
BEGIN;
CREATE TYPE "TipoNotificacion_new" AS ENUM ('SOLICITUD_ASIGNADA', 'SOLICITUD_DERIVADA', 'SOLICITUD_APROBADA', 'SOLICITUD_OBSERVADA', 'RENDICION_PENDIENTE', 'RENDICION_OBSERVADA', 'CUADRO_PENDIENTE_VALIDACION', 'CUADRO_PENDIENTE_REVISION', 'CUADRO_OBSERVADO', 'CUADRO_APROBADO', 'PAGO_PENDIENTE_APROBACION', 'PAGO_OBSERVADO', 'PAGO_REALIZADO', 'INFORME_VIAJE_PENDIENTE', 'INFORME_VIAJE_REVISADO', 'INFORME_VIAJE_OBSERVADO', 'LIQUIDACION_VIATICOS_PENDIENTE', 'LIQUIDACION_VIATICOS_REVISADA', 'LIQUIDACION_VIATICOS_OBSERVADA');
ALTER TABLE "Notificacion" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "Notificacion" ALTER COLUMN "tipo" TYPE "TipoNotificacion_new" USING ("tipo"::text::"TipoNotificacion_new");
ALTER TYPE "TipoNotificacion" RENAME TO "TipoNotificacion_old";
ALTER TYPE "TipoNotificacion_new" RENAME TO "TipoNotificacion";
DROP TYPE "TipoNotificacion_old";
ALTER TABLE "Notificacion" ALTER COLUMN "tipo" SET DEFAULT 'SOLICITUD_ASIGNADA';
COMMIT;

-- DropForeignKey
ALTER TABLE "PlanViaje" DROP CONSTRAINT "PlanViaje_directorProgramaId_fkey";

-- DropIndex
DROP INDEX "PlanViaje_directorProgramaId_idx";

-- DropIndex
DROP INDEX "PlanViaje_estado_idx";

-- AlterTable
ALTER TABLE "PlanViaje" DROP COLUMN "directorProgramaId",
DROP COLUMN "estado",
DROP COLUMN "fechaAprobacion",
DROP COLUMN "observacion";

-- DropEnum
DROP TYPE "EstadoPlanViaje";

