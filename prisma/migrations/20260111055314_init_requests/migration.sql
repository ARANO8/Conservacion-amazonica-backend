/*
  Warnings:

  - You are about to drop the column `accountNumber` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `activityId` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `bankName` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `checkNumber` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `currency` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `motive` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `place` on the `Request` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `RequestItem` table. All the data in the column will be lost.
  - You are about to drop the column `totalCost` on the `RequestItem` table. All the data in the column will be lost.
  - You are about to drop the column `unitCost` on the `RequestItem` table. All the data in the column will be lost.
  - Added the required column `description` to the `Request` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Request` table without a default value. This is not possible if the table is not empty.
  - Added the required column `amount` to the `RequestItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `financingSourceId` to the `RequestItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `budgetLineId` on table `RequestItem` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_activityId_fkey";

-- DropForeignKey
ALTER TABLE "RequestItem" DROP CONSTRAINT "RequestItem_budgetLineId_fkey";

-- AlterTable
ALTER TABLE "Request" DROP COLUMN "accountNumber",
DROP COLUMN "activityId",
DROP COLUMN "bankName",
DROP COLUMN "checkNumber",
DROP COLUMN "currency",
DROP COLUMN "date",
DROP COLUMN "motive",
DROP COLUMN "place",
ADD COLUMN     "approverId" INTEGER,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "RequestItem" DROP COLUMN "quantity",
DROP COLUMN "totalCost",
DROP COLUMN "unitCost",
ADD COLUMN     "amount" DECIMAL(15,2) NOT NULL,
ADD COLUMN     "financingSourceId" TEXT NOT NULL,
ALTER COLUMN "budgetLineId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_financingSourceId_fkey" FOREIGN KEY ("financingSourceId") REFERENCES "FinancingSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
