-- DropIndex
DROP INDEX "PoaActivity_code_project_key";

-- AlterTable
ALTER TABLE "PoaActivity" ADD COLUMN     "ac" TEXT,
ADD COLUMN     "group" TEXT,
ADD COLUMN     "oe" TEXT,
ADD COLUMN     "og" TEXT,
ADD COLUMN     "op" TEXT,
ADD COLUMN     "poaBudgetLine" TEXT,
ADD COLUMN     "totalCost" DOUBLE PRECISION,
ADD COLUMN     "unitCost" DOUBLE PRECISION;
