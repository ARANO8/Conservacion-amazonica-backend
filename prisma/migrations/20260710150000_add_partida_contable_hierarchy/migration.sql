-- Agregar columnas jerárquicas a PartidaContable
ALTER TABLE "PartidaContable" ADD COLUMN IF NOT EXISTS "descripcion" TEXT;
ALTER TABLE "PartidaContable" ADD COLUMN IF NOT EXISTS "nivel" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PartidaContable" ADD COLUMN IF NOT EXISTS "tipo" TEXT;
ALTER TABLE "PartidaContable" ADD COLUMN IF NOT EXISTS "monetaria" TEXT;
ALTER TABLE "PartidaContable" ADD COLUMN IF NOT EXISTS "auxiliar" TEXT;
ALTER TABLE "PartidaContable" ADD COLUMN IF NOT EXISTS "parentId" INTEGER;

-- Índice y FK para la auto-referencia jerárquica
CREATE INDEX IF NOT EXISTS "PartidaContable_parentId_idx" ON "PartidaContable"("parentId");
ALTER TABLE "PartidaContable" ADD CONSTRAINT "PartidaContable_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PartidaContable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
