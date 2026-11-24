-- Plan de cuentas actualizado ("002 PLAN DE CUENTAS.pdf", noviembre 2026).
-- Solo datos: renombra las cuentas de EGRESOS que cambiaron y agrega las dos
-- nuevas. Los gastos ya clasificados conservan su cuenta (mismo código).
-- En una base sin sembrar no hace nada: el seed carga el plan completo.

UPDATE "PartidaContable" SET "nombre" = 'Técnico I Áreas Protegidas Beni', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.02';
UPDATE "PartidaContable" SET "nombre" = 'Técnico II en Biodiversidad', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.04';
UPDATE "PartidaContable" SET "nombre" = 'Especialista I en Geo. Ambiental', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.05';
UPDATE "PartidaContable" SET "nombre" = 'Técnico I en Gobernanza', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.13';
UPDATE "PartidaContable" SET "nombre" = 'Especialista II en Redacción y Prensa', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.14';
UPDATE "PartidaContable" SET "nombre" = 'Especialista II en Manejo de PFNM', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.15';
UPDATE "PartidaContable" SET "nombre" = 'Especialista II en Com. Externa', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.22';
UPDATE "PartidaContable" SET "nombre" = 'Especialista II en Diseño y Medios', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.23';
UPDATE "PartidaContable" SET "nombre" = 'Especialista II en Control Territorial', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.24';
UPDATE "PartidaContable" SET "nombre" = 'Especialista II en Areas de Conserv. Pando', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.25';
UPDATE "PartidaContable" SET "nombre" = 'Especialista II en Manejo de PFNM', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.28';
UPDATE "PartidaContable" SET "nombre" = 'Especialista II en Minería Aluvial', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.29';
UPDATE "PartidaContable" SET "nombre" = 'Encargado de Logistíca', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.32';
UPDATE "PartidaContable" SET "nombre" = 'Especialista I en Ciencia de Datos', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.38';
UPDATE "PartidaContable" SET "nombre" = 'Técnico I en Gestión Social', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.39';
UPDATE "PartidaContable" SET "nombre" = 'Especialista I de Art. para la Conserv.', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.40';
UPDATE "PartidaContable" SET "nombre" = 'Especialista I Legal en Conserv. y Gestión Terr.', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.41';
UPDATE "PartidaContable" SET "nombre" = 'Técnico I en Comunidad de Prácticas', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.48';
UPDATE "PartidaContable" SET "nombre" = 'Responsable RRHH y Asist. Ctable', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.64';
UPDATE "PartidaContable" SET "nombre" = 'Especilialista II en Monitoreo', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.90';
UPDATE "PartidaContable" SET "nombre" = 'Técnico I Socioeconómico', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.1.1.1.93';
UPDATE "PartidaContable" SET "nombre" = 'Sub - Convenio CITRMD', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.2.1.1.01';
UPDATE "PartidaContable" SET "nombre" = 'Sub - Convenio PROFIT RURAL', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.2.1.1.02';
UPDATE "PartidaContable" SET "nombre" = 'Sub - Convenio (Otros)', "monetaria" = 'Bolivianos', "auxiliar" = NULL WHERE "codigo" = '5.2.1.1.03';

INSERT INTO "PartidaContable" ("codigo", "nombre", "nivel", "monetaria", "auxiliar", "parentId")
SELECT '5.1.1.2.06', 'Capacitaciones', 4, 'Bolivianos', NULL, p."id"
FROM "PartidaContable" p WHERE p."codigo" = '5.1.1.2.00'
ON CONFLICT ("codigo") DO NOTHING;
INSERT INTO "PartidaContable" ("codigo", "nombre", "nivel", "monetaria", "auxiliar", "parentId")
SELECT '5.1.5.8.00', 'Gastos Varios Aduana', 3, 'Bolivianos', NULL, p."id"
FROM "PartidaContable" p WHERE p."codigo" = '5.1.5.0.00'
ON CONFLICT ("codigo") DO NOTHING;
