-- CreateIndex
CREATE INDEX "Cotizacion_usuarioEmisorId_idx" ON "Cotizacion"("usuarioEmisorId");

-- CreateIndex
CREATE INDEX "Cotizacion_deletedAt_idx" ON "Cotizacion"("deletedAt");

-- CreateIndex
CREATE INDEX "CuadroComparativo_usuarioEmisorId_idx" ON "CuadroComparativo"("usuarioEmisorId");

-- CreateIndex
CREATE INDEX "CuadroComparativo_deletedAt_idx" ON "CuadroComparativo"("deletedAt");

-- CreateIndex
CREATE INDEX "DeclaracionJurada_rendicionId_idx" ON "DeclaracionJurada"("rendicionId");

-- CreateIndex
CREATE INDEX "Gasto_solicitudId_idx" ON "Gasto"("solicitudId");

-- CreateIndex
CREATE INDEX "Gasto_solicitudPresupuestoId_idx" ON "Gasto"("solicitudPresupuestoId");

-- CreateIndex
CREATE INDEX "GastoCompra_solicitudId_idx" ON "GastoCompra"("solicitudId");

-- CreateIndex
CREATE INDEX "GastoCompra_solicitudPresupuestoId_idx" ON "GastoCompra"("solicitudPresupuestoId");

-- CreateIndex
CREATE INDEX "GastoCompra_deletedAt_idx" ON "GastoCompra"("deletedAt");

-- CreateIndex
CREATE INDEX "GastoRendicion_rendicionId_idx" ON "GastoRendicion"("rendicionId");

-- CreateIndex
CREATE INDEX "GastoRendicion_partidaId_idx" ON "GastoRendicion"("partidaId");

-- CreateIndex
CREATE INDEX "HistorialAprobacion_solicitudId_idx" ON "HistorialAprobacion"("solicitudId");

-- CreateIndex
CREATE INDEX "HistorialAprobacion_rendicionId_idx" ON "HistorialAprobacion"("rendicionId");

-- CreateIndex
CREATE INDEX "HistorialAprobacion_cuadroComparativoId_idx" ON "HistorialAprobacion"("cuadroComparativoId");

-- CreateIndex
CREATE INDEX "HistorialAprobacion_usuarioId_idx" ON "HistorialAprobacion"("usuarioId");

-- CreateIndex
CREATE INDEX "Hospedaje_solicitudId_idx" ON "Hospedaje"("solicitudId");

-- CreateIndex
CREATE INDEX "Hospedaje_poaId_idx" ON "Hospedaje"("poaId");

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_leida_idx" ON "Notificacion"("usuarioId", "leida");

-- CreateIndex
CREATE INDEX "OrdenCompra_cuadroComparativoId_idx" ON "OrdenCompra"("cuadroComparativoId");

-- CreateIndex
CREATE INDEX "OrdenCompra_usuarioEmisorId_idx" ON "OrdenCompra"("usuarioEmisorId");

-- CreateIndex
CREATE INDEX "OrdenCompra_deletedAt_idx" ON "OrdenCompra"("deletedAt");

-- CreateIndex
CREATE INDEX "Rendicion_deletedAt_idx" ON "Rendicion"("deletedAt");

-- CreateIndex
CREATE INDEX "Solicitud_usuarioEmisorId_idx" ON "Solicitud"("usuarioEmisorId");

-- CreateIndex
CREATE INDEX "Solicitud_aprobadorId_idx" ON "Solicitud"("aprobadorId");

-- CreateIndex
CREATE INDEX "Solicitud_deletedAt_idx" ON "Solicitud"("deletedAt");

-- CreateIndex
CREATE INDEX "SolicitudPresupuesto_poaId_idx" ON "SolicitudPresupuesto"("poaId");

-- CreateIndex
CREATE INDEX "Viatico_solicitudId_idx" ON "Viatico"("solicitudId");

-- CreateIndex
CREATE INDEX "Viatico_solicitudPresupuestoId_idx" ON "Viatico"("solicitudPresupuestoId");
