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

## Formato estándar de documentos (27 Sep)

- **Backend:** Todos los documentos comparten `templates/partials/` (`estilos-documento`, `encabezado`, `logos`): tipografía Bookman y hoja del ANEXO 1, con los logos de ACEAA y AMZ desk a la izquierda. Cotización, cuadro comparativo, orden de compra, ANEXO 3 y ANEXO 6 dejan de cargar Tailwind desde un CDN, así que el PDF ya no depende de internet. ANEXO 2 y 4 conservan su grilla oficial con ambos logos, y el Excel del ANEXO 4 también los lleva. Margen uniforme de 12 mm
- **Backend:** Los servicios arman un `DocumentoPdf` una sola vez y lo convierten en PDF o en HTML; endpoints `GET :id/documento` para cotización, cuadro, orden, solicitud y declaración de movilidad
- **Frontend:** `DocumentoViewer`: el detalle de cada documento se ve idéntico a su PDF

## Informe de Viaje — ANEXO 7 (27 Sep) · spec 022

- **Ambos:** "Informe de Actividades" pasa a llamarse **Informe de Viaje** en todo el sistema: módulo `informes-viaje`, ruta `/app/informes-viaje` y modelo `InformeViaje` (la migración renombra las tablas y conserva los datos)
- **Backend:** Formato ANEXO 7 en HTML y PDF sobre la plantilla común; el informe nace de una solicitud de viaje propia y desembolsada (1:1), con precarga desde el plan de viaje; revisión del Director de Programa (`EstadoInformeViaje`) con historial y tres `TipoNotificacion` nuevos. El revisor propuesto se descarta si es Tesorero o el propio emisor
- **Backend:** La solicitud y la rendición incluyen el informe de su viaje
- **Frontend:** Formulario ANEXO 7 con selector de solicitud, bandeja "Por revisar", detalle idéntico al PDF, y aviso en la rendición cuando falta el informe (no bloquea)

## Liquidación de Viáticos — ANEXO 5 (28 Sep) · spec 008

- **Backend:** Módulo `liquidaciones-viaticos`: una liquidación por solicitud de viaje propia y desembolsada (1:1) con **una hoja por persona institucional**, precargada desde los viáticos y participantes de la solicitud con las tarifas vigentes del catálogo. Cálculo líquido primero (tarifa × días × 100/50 %), bruto = líquido ÷ 0,87 y RC-IVA como diferencia, siempre recalculado en el servidor
- **Backend:** Revisión del Director de Programa (`EstadoLiquidacionViaticos`) con historial y tres `TipoNotificacion` nuevos; ANEXO 5 en HTML y PDF (`anexo5.hbs`) del viaje completo o de una persona, con "Revisado por" y el recuadro de firma y C.I. del beneficiario
- **Backend:** `GET /liquidaciones-viaticos/solicitud/:id/gastos-lv` entrega la liquidación revisada como gastos `LV` (uno por hoja y partida); `GastoRendicion.hojaLiquidacionId` ata el gasto a su hoja. `Usuario.ci` nuevo; la hoja lo toma del perfil si viene vacío
- **Frontend:** Módulo `app/app/liquidaciones-viaticos/` con formulario por persona y totales en vivo, advertencia (no bloqueante) si lo liquidado supera lo presupuestado, detalle con pestañas por persona y bandeja "Por revisar"
- **Frontend:** La rendición importa los gastos `LV` de la liquidación revisada sin duplicarlos; campo C.I. en la gestión de usuarios

## Plan de Viaje sin VoBo — ANEXO 1 (14 Oct) · spec 023

- **Backend:** El plan de viaje deja de pasar por el VoBo del Director de Programa: se eliminan los endpoints `enviar`, `aprobar`, `observar` y `pendientes`, los campos `estado`, `observacion`, `fechaAprobacion` y `directorProgramaId`, el enum `EstadoPlanViaje` y los tres `TipoNotificacion` `PLAN_VIAJE_*`
- **Backend:** Una solicitud de viaje puede nacer de cualquier plan propio, libre y **completo** (la nómina institucional cuadra y cada actividad tiene salida y llegada); `?disponibles=true` filtra por eso. El plan se edita libremente mientras no respalde una solicitud, y vinculado solo si esa solicitud está observada
- **Backend:** El ANEXO 1 firma "VoBo. Director Ejecutivo" con `DESTINATARIO_ANEXOS` (Marcos F. Terán Valenzuela)
- **Backend:** El Director de Programa de la solicitud de viaje lo elige el emisor; la API lo exige explícitamente
- **Backend:** Migración: borra los planes `ENVIADO` (con su historial y notificaciones) y las notificaciones `PLAN_VIAJE_*`
- **Frontend:** Planes de viaje sin bandeja "Por aprobar" ni acciones de VoBo; el listado muestra si cada plan está incompleto, disponible o vinculado; el Director de Programa se elige al enviar la solicitud

## Datos del personal (27 Oct) · spec 024

- **Backend:** `enum Sede` (La Paz, Trinidad, Cobija) y `Usuario.sede`; el DTO de usuarios la acepta y el lookup de usuarios la expone (el C.I. sigue solo para `ADMIN`)
- **Backend:** `Usuario.csv` del seed se rehace desde la planilla de ACEAA: cargo, C.I. normalizado y sede de 55 personas, y 7 cuentas nuevas. El seed escribe C.I. y sede, y una columna vacía no pisa lo cargado a mano
- **Backend:** el plan de viaje propone como lugar de emisión la sede del responsable (o "La Paz" si no tiene)
- **Frontend:** sede en la gestión de usuarios (selector y columna) y precarga del lugar de emisión del ANEXO 1

## Logos en los documentos (29 Oct)

- **Backend:** Todos los anexos y documentos llevan el logo de ACEAA a la izquierda y el de AMZ desk a la derecha, en HTML, PDF y en el Excel del ANEXO 4. El parcial `logos` se separa en `logo-aceaa` y `logo-amz`

## ANEXO 5 sin tipo de cambio (30 Oct)

- **Backend:** La Liquidación de Viáticos ya no lleva el T/C $us (el tipo de cambio es variable): se quita del documento y la columna `LiquidacionViaticos.tipoCambio` (migración `20261030120000_liquidacion_sin_tipo_cambio`)
- **Backend:** En el ANEXO 5, "Lugar y Fecha" va en formato literal ("La Paz, 28 de septiembre de 2026") y alineado a la izquierda, igual que Proyecto y Actividad
- **Frontend:** Se quita `tipoCambio` del tipo de la liquidación

## Cargo en las firmas (30 Oct) — spec 025

- **Backend:** Cada firma con nombre imprime el cargo debajo: ANEXO 1 (responsable y VoBo del Director Ejecutivo), ANEXO 2 (solicitado y revisado por, y los viajeros institucionales de la nómina), ANEXO 5 (revisado por y fila CARGO del beneficiario), ANEXO 6 (preparado por), ANEXO 7 (preparado y revisado por) y orden de compra (elaborado por)

## Firmas de Dirección en los anexos (30 Oct)

- **Backend:** ANEXO 5 y ANEXO 6 firman "Revisado por" la Dirección Financiera (usuario `TESORERO`) y "Aprobado por" el Director Ejecutivo, con nombre y cargo, como ya lo hacía el ANEXO 4. El ANEXO 5 deja de mostrar al Director de Programa en "Revisado por" (sigue revisando la liquidación en el sistema). Helper compartido `pdf/firmas-direccion.ts`
