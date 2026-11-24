-- ANEXO 1: el Plan de Viaje pasa a ser un documento propio y las filas de
-- Planificacion dejan de colgar de la Solicitud para colgar del plan.
-- Incluye el backfill: cada solicitud existente con planificaciones recibe un
-- plan APROBADO con sus mismas actividades.

-- CreateEnum
CREATE TYPE "EstadoPlanViaje" AS ENUM ('BORRADOR', 'ENVIADO', 'OBSERVADO', 'APROBADO');

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'PLAN_VIAJE_PENDIENTE';
ALTER TYPE "TipoNotificacion" ADD VALUE 'PLAN_VIAJE_APROBADO';
ALTER TYPE "TipoNotificacion" ADD VALUE 'PLAN_VIAJE_OBSERVADO';

-- CreateTable (con una columna temporal para el backfill)
CREATE TABLE "PlanViaje" (
    "id" SERIAL NOT NULL,
    "codigoPlan" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "lugaresViaje" TEXT NOT NULL,
    "objetivoViaje" TEXT NOT NULL,
    "lugarEmision" TEXT NOT NULL DEFAULT 'La Paz',
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPlanViaje" NOT NULL DEFAULT 'BORRADOR',
    "observacion" TEXT,
    "usuarioId" INTEGER NOT NULL,
    "directorProgramaId" INTEGER,
    "fechaAprobacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "solicitudOrigenId" INTEGER,

    CONSTRAINT "PlanViaje_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "HistorialAprobacion" ADD COLUMN "planViajeId" INTEGER;
ALTER TABLE "Notificacion" ADD COLUMN "planViajeId" INTEGER;
ALTER TABLE "Solicitud" ADD COLUMN "planViajeId" INTEGER;
ALTER TABLE "Planificacion"
ADD COLUMN "lugarLlegada" TEXT,
ADD COLUMN "lugarSalida" TEXT,
ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "planViajeId" INTEGER;

-- Backfill 1: un plan por solicitud con planificaciones. El código sigue el
-- correlativo anual PV-AAAA-NNN por fecha de creación de la solicitud.
INSERT INTO "PlanViaje" (
    "codigoPlan", "cargo", "lugaresViaje", "objetivoViaje", "lugarEmision",
    "fechaEmision", "estado", "usuarioId", "directorProgramaId",
    "fechaAprobacion", "createdAt", "updatedAt", "deletedAt", "solicitudOrigenId"
)
SELECT
    'PV-' || EXTRACT(YEAR FROM s."createdAt")::INT || '-' ||
        LPAD((ROW_NUMBER() OVER (
            PARTITION BY EXTRACT(YEAR FROM s."createdAt")
            ORDER BY s."createdAt", s."id"
        ))::TEXT, 3, '0'),
    COALESCE(u."cargo", ''),
    COALESCE(s."lugarViaje", ''),
    COALESCE(s."motivoViaje", ''),
    'La Paz',
    s."fechaSolicitud",
    'APROBADO',
    s."usuarioEmisorId",
    s."directorProgramaId",
    s."createdAt",
    s."createdAt",
    s."updatedAt",
    s."deletedAt",
    s."id"
FROM "Solicitud" s
JOIN "Usuario" u ON u."id" = s."usuarioEmisorId"
WHERE EXISTS (SELECT 1 FROM "Planificacion" p WHERE p."solicitudId" = s."id");

-- Backfill 2: enlazar solicitud y actividades con su plan
UPDATE "Solicitud" s
SET "planViajeId" = pv."id"
FROM "PlanViaje" pv
WHERE pv."solicitudOrigenId" = s."id";

UPDATE "Planificacion" p
SET "planViajeId" = pv."id",
    "orden" = o."orden"
FROM "PlanViaje" pv,
     (SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "solicitudId" ORDER BY "id") - 1)::INT AS "orden"
      FROM "Planificacion") o
WHERE pv."solicitudOrigenId" = p."solicitudId"
  AND o."id" = p."id";

-- Fin del backfill
ALTER TABLE "PlanViaje" DROP COLUMN "solicitudOrigenId";
ALTER TABLE "Planificacion" DROP CONSTRAINT "Planificacion_solicitudId_fkey";
ALTER TABLE "Planificacion" DROP COLUMN "solicitudId";
ALTER TABLE "Planificacion" ALTER COLUMN "planViajeId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PlanViaje_codigoPlan_key" ON "PlanViaje"("codigoPlan");
CREATE INDEX "PlanViaje_usuarioId_idx" ON "PlanViaje"("usuarioId");
CREATE INDEX "PlanViaje_directorProgramaId_idx" ON "PlanViaje"("directorProgramaId");
CREATE INDEX "PlanViaje_estado_idx" ON "PlanViaje"("estado");
CREATE INDEX "PlanViaje_deletedAt_idx" ON "PlanViaje"("deletedAt");
CREATE INDEX "HistorialAprobacion_planViajeId_idx" ON "HistorialAprobacion"("planViajeId");
CREATE INDEX "Planificacion_planViajeId_idx" ON "Planificacion"("planViajeId");
CREATE UNIQUE INDEX "Solicitud_planViajeId_key" ON "Solicitud"("planViajeId");

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_planViajeId_fkey" FOREIGN KEY ("planViajeId") REFERENCES "PlanViaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HistorialAprobacion" ADD CONSTRAINT "HistorialAprobacion_planViajeId_fkey" FOREIGN KEY ("planViajeId") REFERENCES "PlanViaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_planViajeId_fkey" FOREIGN KEY ("planViajeId") REFERENCES "PlanViaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlanViaje" ADD CONSTRAINT "PlanViaje_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanViaje" ADD CONSTRAINT "PlanViaje_directorProgramaId_fkey" FOREIGN KEY ("directorProgramaId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Planificacion" ADD CONSTRAINT "Planificacion_planViajeId_fkey" FOREIGN KEY ("planViajeId") REFERENCES "PlanViaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;
