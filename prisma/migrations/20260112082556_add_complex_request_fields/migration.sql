/*
  Warnings:

  - You are about to drop the column `amount` on the `RequestItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "place" TEXT,
ADD COLUMN     "poaCode" TEXT,
ADD COLUMN     "receiverName" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RequestItem" DROP COLUMN "amount",
ADD COLUMN     "detail" TEXT,
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unitCost" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "TravelExpense" (
    "id" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "city" TEXT,
    "destination" TEXT,
    "transportType" TEXT,
    "days" INTEGER,
    "peopleCount" INTEGER,
    "requestId" TEXT NOT NULL,

    CONSTRAINT "TravelExpense_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TravelExpense" ADD CONSTRAINT "TravelExpense_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
