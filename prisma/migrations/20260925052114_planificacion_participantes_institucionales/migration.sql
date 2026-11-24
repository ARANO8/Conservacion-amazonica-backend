-- CreateTable
CREATE TABLE "_PlanificacionParticipantes" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_PlanificacionParticipantes_AB_unique" ON "_PlanificacionParticipantes"("A", "B");

-- CreateIndex
CREATE INDEX "_PlanificacionParticipantes_B_index" ON "_PlanificacionParticipantes"("B");

-- AddForeignKey
ALTER TABLE "_PlanificacionParticipantes" ADD CONSTRAINT "_PlanificacionParticipantes_A_fkey" FOREIGN KEY ("A") REFERENCES "Planificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PlanificacionParticipantes" ADD CONSTRAINT "_PlanificacionParticipantes_B_fkey" FOREIGN KEY ("B") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
