-- AlterTable
ALTER TABLE "Proyecto" ADD COLUMN     "cuentaBancariaId" INTEGER;

-- CreateTable
CREATE TABLE "CuentaBancaria" (
    "id" SERIAL NOT NULL,
    "numeroCuenta" TEXT NOT NULL,
    "banco" TEXT NOT NULL DEFAULT 'BISA S.A.',
    "moneda" TEXT NOT NULL DEFAULT 'M/N',

    CONSTRAINT "CuentaBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuentaBancaria_numeroCuenta_key" ON "CuentaBancaria"("numeroCuenta");

-- AddForeignKey
ALTER TABLE "Proyecto" ADD CONSTRAINT "Proyecto_cuentaBancariaId_fkey" FOREIGN KEY ("cuentaBancariaId") REFERENCES "CuentaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
