-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('BOB', 'USD');

-- AlterTable
ALTER TABLE "Concepto" ADD COLUMN     "moneda" "Moneda" NOT NULL DEFAULT 'BOB';

-- AlterTable
ALTER TABLE "Hospedaje" ADD COLUMN     "tipoPersonal" "TipoDestino" NOT NULL DEFAULT 'INSTITUCIONAL';

-- Tarifas de viáticos del "Instructivo de Viaje y Viáticos" (03/08/2026).
-- Montos líquidos diarios; las solicitudes existentes guardan su propio monto
-- y no se ven afectadas.
UPDATE "Concepto" SET "precioInstitucional" = 250, "precioTerceros" = 200 WHERE "nombre" = 'CIUDADES_PRINCIPALES';
UPDATE "Concepto" SET "precioInstitucional" = 162, "precioTerceros" = 135 WHERE "nombre" = 'CIUDADES_INTERMEDIAS';
UPDATE "Concepto" SET "precioInstitucional" = 144, "precioTerceros" = 0   WHERE "nombre" = 'PUEBLOS';
UPDATE "Concepto" SET "precioInstitucional" = 108, "precioTerceros" = 0   WHERE "nombre" = 'COMUNIDADES';

-- Internacionales: institucionales en USD, terceros en países limítrofes en Bs
INSERT INTO "Concepto" ("nombre", "precioInstitucional", "precioTerceros", "moneda") VALUES
  ('PAISES_SUDAMERICA', 90, 0, 'USD'),
  ('PAISES_NORTEAMERICA_EUROPA', 130, 0, 'USD'),
  ('PAISES_LIMITROFES', 0, 500, 'BOB')
ON CONFLICT ("nombre") DO UPDATE SET
  "precioInstitucional" = EXCLUDED."precioInstitucional",
  "precioTerceros" = EXCLUDED."precioTerceros",
  "moneda" = EXCLUDED."moneda";
