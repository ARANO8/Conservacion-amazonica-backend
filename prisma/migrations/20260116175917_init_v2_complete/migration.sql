-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'TESORERO', 'USUARIO');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('EN_SOLICITUD', 'DESEMBOLSADO', 'EJECUTADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoPoa" AS ENUM ('ACTIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "AccionHistorial" AS ENUM ('APROBADO', 'RECHAZADO', 'DERIVADO');

-- CreateEnum
CREATE TYPE "TipoDestino" AS ENUM ('INSTITUCIONAL', 'TERCEROS');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('FACTURA', 'RECIBO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'USUARIO',
    "cargo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partida" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Partida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodigoPresupuestario" (
    "id" SERIAL NOT NULL,
    "codigoCompleto" TEXT NOT NULL,

    CONSTRAINT "CodigoPresupuestario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actividad" (
    "id" SERIAL NOT NULL,
    "detalleDescripcion" TEXT NOT NULL,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstructuraProgramatica" (
    "id" SERIAL NOT NULL,
    "proyectoId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "partidaId" INTEGER NOT NULL,

    CONSTRAINT "EstructuraProgramatica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poa" (
    "id" SERIAL NOT NULL,
    "codigoPoa" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" DECIMAL(10,2) NOT NULL,
    "costoTotal" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoPoa" NOT NULL DEFAULT 'ACTIVO',
    "deletedAt" TIMESTAMP(3),
    "estructuraId" INTEGER NOT NULL,
    "codigoPresupuestarioId" INTEGER NOT NULL,
    "actividadId" INTEGER NOT NULL,

    CONSTRAINT "Poa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Solicitud" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivoViaje" TEXT,
    "lugarViaje" TEXT,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "codigoDesembolso" TEXT,
    "montoTotal" DECIMAL(10,2) NOT NULL,
    "liquidoPagable" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'EN_SOLICITUD',
    "deletedAt" TIMESTAMP(3),
    "usuarioEmisorId" INTEGER NOT NULL,
    "usuarioAprobadorId" INTEGER,
    "usuarioBeneficiadoId" INTEGER,
    "poaId" INTEGER,
    "planificacionId" INTEGER,

    CONSTRAINT "Solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialAprobacion" (
    "id" SERIAL NOT NULL,
    "accion" "AccionHistorial" NOT NULL,
    "comentario" TEXT,
    "fechaAccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solicitudId" INTEGER NOT NULL,
    "usuarioActorId" INTEGER NOT NULL,

    CONSTRAINT "HistorialAprobacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" SERIAL NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "solicitudId" INTEGER,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rendicion" (
    "id" SERIAL NOT NULL,
    "fechaRendicion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "montoRespaldado" DECIMAL(10,2) NOT NULL,
    "saldoADevolver" DECIMAL(10,2) NOT NULL,
    "observaciones" TEXT,
    "solicitudId" INTEGER NOT NULL,

    CONSTRAINT "Rendicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planificacion" (
    "id" SERIAL NOT NULL,
    "actividadProgramada" TEXT NOT NULL,
    "cantidadPersonasInstitucional" INTEGER NOT NULL DEFAULT 0,
    "cantidadPersonasTerceros" INTEGER NOT NULL DEFAULT 0,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "diasCalculados" INTEGER NOT NULL,

    CONSTRAINT "Planificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concepto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "precioInstitucional" DECIMAL(10,2) NOT NULL,
    "precioTerceros" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "Concepto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Viatico" (
    "id" SERIAL NOT NULL,
    "tipoDestino" "TipoDestino" NOT NULL,
    "dias" INTEGER NOT NULL,
    "costoUnitario" DECIMAL(10,2) NOT NULL,
    "totalBs" DECIMAL(10,2) NOT NULL,
    "iva13" DECIMAL(10,2) NOT NULL,
    "it3" DECIMAL(10,2) NOT NULL,
    "liquidoPagable" DECIMAL(10,2) NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "planificacionId" INTEGER NOT NULL,
    "conceptoId" INTEGER NOT NULL,

    CONSTRAINT "Viatico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoGasto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "TipoGasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" SERIAL NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" DECIMAL(10,2) NOT NULL,
    "totalBs" DECIMAL(10,2) NOT NULL,
    "iva13" DECIMAL(10,2) NOT NULL,
    "it3" DECIMAL(10,2) NOT NULL,
    "iue5" DECIMAL(10,2) NOT NULL,
    "liquidoPagable" DECIMAL(10,2) NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "grupoId" INTEGER NOT NULL,
    "partidaId" INTEGER NOT NULL,
    "tipoGastoId" INTEGER NOT NULL,

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonaExterna" (
    "id" SERIAL NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "procedenciaInstitucion" TEXT NOT NULL,
    "solicitudId" INTEGER NOT NULL,

    CONSTRAINT "PersonaExterna_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EstructuraProgramatica_proyectoId_grupoId_partidaId_key" ON "EstructuraProgramatica"("proyectoId", "grupoId", "partidaId");

-- CreateIndex
CREATE UNIQUE INDEX "Solicitud_poaId_key" ON "Solicitud"("poaId");

-- CreateIndex
CREATE UNIQUE INDEX "Rendicion_solicitudId_key" ON "Rendicion"("solicitudId");

-- AddForeignKey
ALTER TABLE "EstructuraProgramatica" ADD CONSTRAINT "EstructuraProgramatica_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstructuraProgramatica" ADD CONSTRAINT "EstructuraProgramatica_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EstructuraProgramatica" ADD CONSTRAINT "EstructuraProgramatica_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poa" ADD CONSTRAINT "Poa_estructuraId_fkey" FOREIGN KEY ("estructuraId") REFERENCES "EstructuraProgramatica"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poa" ADD CONSTRAINT "Poa_codigoPresupuestarioId_fkey" FOREIGN KEY ("codigoPresupuestarioId") REFERENCES "CodigoPresupuestario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poa" ADD CONSTRAINT "Poa_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_usuarioEmisorId_fkey" FOREIGN KEY ("usuarioEmisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_usuarioAprobadorId_fkey" FOREIGN KEY ("usuarioAprobadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_usuarioBeneficiadoId_fkey" FOREIGN KEY ("usuarioBeneficiadoId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_poaId_fkey" FOREIGN KEY ("poaId") REFERENCES "Poa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_planificacionId_fkey" FOREIGN KEY ("planificacionId") REFERENCES "Planificacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialAprobacion" ADD CONSTRAINT "HistorialAprobacion_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialAprobacion" ADD CONSTRAINT "HistorialAprobacion_usuarioActorId_fkey" FOREIGN KEY ("usuarioActorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rendicion" ADD CONSTRAINT "Rendicion_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viatico" ADD CONSTRAINT "Viatico_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viatico" ADD CONSTRAINT "Viatico_planificacionId_fkey" FOREIGN KEY ("planificacionId") REFERENCES "Planificacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Viatico" ADD CONSTRAINT "Viatico_conceptoId_fkey" FOREIGN KEY ("conceptoId") REFERENCES "Concepto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gasto" ADD CONSTRAINT "Gasto_tipoGastoId_fkey" FOREIGN KEY ("tipoGastoId") REFERENCES "TipoGasto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonaExterna" ADD CONSTRAINT "PersonaExterna_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "Solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
