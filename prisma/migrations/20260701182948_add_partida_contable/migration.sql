-- AlterTable
ALTER TABLE "GastoRendicion" ADD COLUMN     "partidaContableId" INTEGER;

-- CreateTable
CREATE TABLE "PartidaContable" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PartidaContable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartidaContable_codigo_key" ON "PartidaContable"("codigo");

-- CreateIndex
CREATE INDEX "GastoRendicion_partidaContableId_idx" ON "GastoRendicion"("partidaContableId");

-- AddForeignKey
ALTER TABLE "GastoRendicion" ADD CONSTRAINT "GastoRendicion_partidaContableId_fkey" FOREIGN KEY ("partidaContableId") REFERENCES "PartidaContable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
