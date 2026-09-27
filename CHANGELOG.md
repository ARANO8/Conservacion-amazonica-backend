# Changelog

> Periodo: 26-May-2026 → 26-Ago-2026
> Frontend: `Conservacion-amazonica-frontend` (HEAD `f55cd60`)
> Backend: `Conservacion-amazonica-backend` (HEAD `44ec7e4`)

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

## Estabilización del PDF y auditoría (21-27 Jul)

- **Backend:** Handlebars por export por defecto en el import dinámico ESM; sintaxis corregida en la plantilla de rendición
- **Backend:** Los endpoints de PDF quedan fuera del throttle; errores visibles en vez de silenciosos
- **Backend:** `@Res` vuelve a no-passthrough para la respuesta binaria del PDF
- **Backend:** Sección de desembolso en la plantilla PDF de solicitud
- **Backend:** URL de comprobante de transferencia obligatoria al desembolsar
- **Backend:** Plan de cuentas, centro de auditoría completo y orden de eliminación del seed del POA
- **Frontend:** Descarga de PDF unificada, validando `content-type`
- **Frontend:** Columna `codigoDesembolso` en solicitudes, monitor, solicitudes de compra y detalle de aprobaciones
- **Frontend:** Fin del bucle infinito al elegir Recibo/Boleta en la tabla de gastos

## Compras, consultorías y retenciones (1-4 Ago)

- **Backend:** Retención impositiva y pagos parciales en gastos de compra
- **Backend:** Ciclo completo de solicitud, aprobación y pago **por cuota** en contratos de consultoría — nace el estado `EstadoSolicitud.EN_EJECUCION` y el enum `EstadoPagoParcial`
- **Backend:** Personas externas vinculadas a su planificación de origen
- **Backend:** ANEXO 4 en rendiciones y arreglo del enlace de comprobantes
- **Backend:** `informes-actividades` pasa a ser un módulo propio, fuera de rendiciones
- **Backend:** Corrección de cálculos en solicitudes de compra y servicio, y del cuadro comparativo
- **Frontend:** Sección de consultoría en solicitudes de compra + cronograma de pagos accionable
- **Frontend:** Parte impositiva en la tabla de gastos y bloques del ANEXO 4
- **Frontend:** Autogeneración de tarjetas de terceros según el conteo del paso 1
- **Frontend:** Informe de actividades como pantalla propia en Viajes y Viáticos
- **Frontend:** Se retiran las dependencias de Prisma del frontend

## Despliegue continuo en VPS (4-17 Ago)

- **Ambos:** Imagen Docker standalone y despliegue automatizado en el VPS con GitHub Actions, disparado por push a `main`
- **Ambos:** La aplicación se sirve bajo el prefijo `/amzdesk`; `exbmail` queda en su propia subruta del dominio
- **Ambos:** Smoke test ejecutado dentro del VPS (no desde el runner) y entrando por la raíz, para detectar bucles de redirección
- **Backend:** Eliminado el bucle de redirecciones en la entrada a `/amzdesk`; logs del proxy y código HTTP visibles
- **Frontend:** El prefijo de la aplicación se aplica también al logo
- **Docs:** El proxy edge se actualiza a mano; el límite de 25 m no es el tope real

## Declaración Jurada de Movilidad — ANEXO 6 (26 Ago)

- **Backend:** Módulo `declaraciones-movilidad`. Retención propia del anexo: IUE 12.5% + IT 3% (`RETENCION_MOVILIDAD_RATE` 15.5%, `FACTOR_MOVILIDAD` 0.845). La planilla Excel rotula 15.5% pero su celda arrastra un `*16%`; aquí se usa la tasa correcta, que es la que hace cerrar el líquido contra lo gastado
- **Frontend:** Formulario de declaración jurada de movilidad en `app/app/declaracion-movilidad/`

---

> Estado al cierre de este changelog: backend `44ec7e4`, frontend `f55cd60` (26-Ago-2026).
> A partir de aquí el trabajo se planifica en `specs/` (ver `CLAUDE.md`, *Flujo de trabajo*).

## Plan de Viaje — ANEXO 1 (26 Sep) · spec 007

- **Backend:** Módulo `planes-viaje`: el plan de viaje deja de ser el Paso 1 del wizard y pasa a ser un documento propio, con VoBo del Director de Programa (`EstadoPlanViaje`: `BORRADOR` → `ENVIADO` → `APROBADO` / `OBSERVADO`), ANEXO 1 en HTML y PDF (`anexo1.hbs`) y tres `TipoNotificacion` nuevos
- **Backend:** `Planificacion` pasa a colgar de `PlanViaje` (con `lugarSalida`, `lugarLlegada` y `orden`); la solicitud de viaje nace de un plan aprobado y libre (`Solicitud.planViajeId`, 1:1) y toma de él lugares, objetivo, fechas y director. Viáticos y nómina de terceros se enlazan por id de actividad; la nómina se valida en la API contra lo declarado en el plan
- **Backend:** El `update` de la solicitud ya no borra las actividades, y registra el historial `CORREGIDO`, que quedaba detrás del `return`
- **Backend:** Migración con backfill: cada solicitud existente con planificación recibe un plan `APROBADO`
- **Frontend:** Módulo `app/app/planes-viaje/` y Paso 1 del wizard como selección del plan aprobado; corrige el adaptador inverso, que perdía la actividad de los viáticos al editar una solicitud observada
