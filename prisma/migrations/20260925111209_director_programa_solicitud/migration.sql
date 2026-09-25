-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN     "directorProgramaId" INTEGER;

-- CreateIndex
CREATE INDEX "Solicitud_directorProgramaId_idx" ON "Solicitud"("directorProgramaId");

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_directorProgramaId_fkey" FOREIGN KEY ("directorProgramaId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: el Director de Programa es el primero, distinto del emisor, que
-- actuó sobre la solicitud (la derivó, la observó o la aprobó). Si nadie
-- actuó todavía, es quien la tiene en su bandeja.
UPDATE "Solicitud" s
SET "directorProgramaId" = COALESCE(
  (
    SELECT h."usuarioId"
    FROM "HistorialAprobacion" h
    WHERE h."solicitudId" = s."id"
      AND h."accion" IN ('DERIVADO', 'OBSERVADO', 'APROBADO')
      AND h."usuarioId" <> s."usuarioEmisorId"
    ORDER BY h."fecha" ASC, h."id" ASC
    LIMIT 1
  ),
  s."aprobadorId"
)
WHERE s."directorProgramaId" IS NULL;
