# Changelog

> Periodo: 26-May-2026 → 16-Jul-2026
> Frontend: `Conservacion-amazonica-frontend` (HEAD `8abc2ee`)
> Backend: `Conservacion-amazonica-backend` (HEAD `b51cf24`)

---

## Fase 0: Integridad de Datos (4 Jun)

- **Backend:** Guarda presupuestaria al aprobar rendición, reconstrucción atómica del cuadro comparativo
- **Backend:** Tests de integridad

## Fase 1: Seguridad y Autenticación (4-5 Jun)

- **Frontend:** Migración de auth a cookie httpOnly
- **Backend:** Cookie httpOnly para JWT, helmet, JWT_SECRET fuerte, contraseñas únicas por seed
- **Backend:** Fix IDOR en solicitudes, rendiciones, cotizaciones, cuadros y órdenes de compra
- **Backend:** Tests de autorización
- **Chore:** Eliminación de specs stub

## Fase 2: Schema, Decimales y Partidas Contables (5 Jun - 5 Jul)

- **Backend:** Centralización de constantes `ESTADOS_COMPROMISO_ACTIVO`
- **Backend:** Soft-delete en lecturas de partidas, grupos, rendiciones
- **Backend:** Cálculo de órdenes de compra en `Prisma.Decimal`
- **Backend:** Eliminación de valores duplicados del enum `EstadoRendicion`
- **Backend:** Schema consistency (migraciones, índices, partida contable con jerarquía)
- **Backend:** Módulo `PartidasContables` (controlador, servicio, seed desde plan-de-cuentas.json)
- **Backend:** Eliminación del módulo obsoleto `reports` (reemplazado por PDF service)
- **Backend:** Utilidad `letras.util.ts` (número a letras)

## Refactor y Dependencias (5 Jul)

- **Frontend:** Actualización de dependencias de seguridad
- **Frontend:** Migración de servicios legacy (`services/` → `lib/services/`)
- **Frontend:** Reemplazo de `next-themes` por ThemeProvider custom
- **Frontend:** Fix React 19 lint rule (setState en useEffect)

## Release: Cotizaciones, Cuadros, Órdenes, Documentos y Rendiciones (10 Jul)

- **Frontend:** Módulo completo de Cotizaciones (crear, editar, ver, listar)
- **Frontend:** Módulo completo de Cuadros Comparativos (builder, análisis, workflow)
- **Frontend:** Módulo completo de Órdenes de Compra (builder, items dialog)
- **Frontend:** Página de Documentos (PDFs instructivos)
- **Frontend:** Refactor completo de Rendiciones (gasto-card, gasto-table, retenciones-table, partidas-presupuestarias, review-modal, checkboxes de validación, tooltips)
- **Frontend:** Centro de Auditoría
- **Frontend:** Sidebar actualizado con nuevas rutas
- **Backend:** Endpoints CRUD para Cotizaciones, Cuadros Comparativos, Órdenes de Compra
- **Backend:** Templates Handlebars para PDFs (cotización, cuadro, orden de compra, rendición)
- **Backend:** Seed de cotizaciones
- **Backend:** Optimización de arranque (lazy puppeteer/handlebars, Swagger lazy-init)
- **Backend:** Seed idempotente, `@Roles` extendido, endpoint PATCH para partida presupuestaria
- **Backend:** Migraciones de esquema para nuevos módulos

## Hotfixes Post-Release (10 Jul)

- **Frontend:** Fix tipos de documento LV/DJ/PPT/PAT/PVT en rendición
- **Frontend:** Unificar footer de gastos con formato de viáticos
- **Frontend:** Invertir dirección cálculo retenciones en rendición (gross-up)
- **Frontend:** Agregar evento CORREGIDO al timeline de auditoría
- **Frontend:** Fix type error tipoDocumento en adapter
- **Backend:** Seed orden de eliminación (SolicitudPresupuesto y Hospedaje antes de POA)
- **Backend:** Centro de auditoría completo (CREADO y CORREGIDO)
- **Backend:** Migración jerarquía PartidaContable

## Sesión 16 Jul

- **Frontend:** Fix input numérico clearable (bug de concatenación "12" en vez de "2")
- **Frontend:** Step 0.5 para Días, step 1 para Pers. Inst. y Pers. Terc. (ArrowUp/Down + Wheel)
- **Frontend:** Eliminación de `console.error` con `{}` en validación (stale formState)
- **Frontend:** Validación Zod con `z.preprocess` para null
- **Frontend:** URL obligatoria en desembolso
- **Backend:** Fix import dinámico de Handlebars en PDF service
