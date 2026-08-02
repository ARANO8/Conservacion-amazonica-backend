-- AlterTable
ALTER TABLE "PersonaExterna" ADD COLUMN     "planificacionId" INTEGER;

-- CreateIndex
CREATE INDEX "PersonaExterna_solicitudId_idx" ON "PersonaExterna"("solicitudId");

-- CreateIndex
CREATE INDEX "PersonaExterna_planificacionId_idx" ON "PersonaExterna"("planificacionId");

-- AddForeignKey
ALTER TABLE "PersonaExterna" ADD CONSTRAINT "PersonaExterna_planificacionId_fkey" FOREIGN KEY ("planificacionId") REFERENCES "Planificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
