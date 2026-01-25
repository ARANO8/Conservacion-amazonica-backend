import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto';
import { AprobarSolicitudDto } from './dto/aprobar-solicitud.dto';
import { ObservarSolicitudDto } from './dto/observar-solicitud.dto';
import { DesembolsarSolicitudDto } from './dto/desembolsar-solicitud.dto';
import {
  Rol,
  EstadoSolicitud,
  Solicitud,
  Prisma,
  EstadoReserva,
} from '@prisma/client';
import { SolicitudPresupuestoService } from '../solicitudes-presupuestos/solicitudes-presupuestos.service';
import { Inject, forwardRef } from '@nestjs/common';

@Injectable()
export class SolicitudesService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => SolicitudPresupuestoService))
    private presupuestoService: SolicitudPresupuestoService,
  ) {}

  private async generarCodigo(): Promise<string> {
    const anioActual = new Date().getFullYear();
    const count = await this.prisma.solicitud.count({
      where: {
        fechaSolicitud: {
          gte: new Date(`${anioActual}-01-01`),
          lte: new Date(`${anioActual}-12-31`),
        },
      },
    });

    const correlativo = (count + 1).toString().padStart(3, '0');
    return `SOL-${anioActual}-${correlativo}`;
  }

  private async prepararInsertAnidado(
    dto: CreateSolicitudDto | UpdateSolicitudDto,
  ): Promise<{
    montoTotalPresupuestado: Prisma.Decimal;
    montoTotalNeto: Prisma.Decimal;
    viaticosData: {
      data: Omit<
        Prisma.ViaticoUncheckedCreateInput,
        'solicitudId' | 'planificacionId'
      >;
      planificacionIndex: number;
    }[];
    gastosData: Omit<Prisma.GastoUncheckedCreateInput, 'solicitudId'>[];
    planificaciones: import('./dto/create-solicitud.dto').CreatePlanificacionDto[];
    nominasTerceros: import('./dto/create-solicitud.dto').CreateNominaDto[];
  }> {
    const {
      planificaciones = [],
      viaticos = [],
      gastos = [],
      nominasTerceros = [],
    } = dto;

    // 1. PRE-CARGA DE CATÁLOGOS (Optimización O(1))
    const [conceptosRaw, tiposGastoRaw] = await Promise.all([
      this.prisma.concepto.findMany(),
      this.prisma.tipoGasto.findMany(),
    ]);

    const conceptosMap = new Map(conceptosRaw.map((c) => [c.id, c]));
    const tiposGastoMap = new Map(tiposGastoRaw.map((tg) => [tg.id, tg]));

    // 2. CÁLCULOS PREVIOS Y VALIDACIONES
    let montoTotalPresupuestado = new Prisma.Decimal(0);
    let montoTotalNeto = new Prisma.Decimal(0);

    const viaticosData: {
      data: Omit<
        Prisma.ViaticoUncheckedCreateInput,
        'solicitudId' | 'planificacionId'
      >;
      planificacionIndex: number;
    }[] = [];

    const gastosData: Omit<Prisma.GastoUncheckedCreateInput, 'solicitudId'>[] =
      [];

    // --- Procesar Viáticos ---
    for (const vDto of viaticos) {
      const concepto = conceptosMap.get(vDto.conceptoId);
      if (!concepto) {
        throw new BadRequestException(
          `Concepto con ID ${vDto.conceptoId} no existe`,
        );
      }

      const planif = planificaciones[vDto.planificacionIndex];
      if (!planif) {
        throw new BadRequestException(
          `Índice de planificación ${vDto.planificacionIndex} es inválido`,
        );
      }

      const dInicio = new Date(planif.fechaInicio);
      const dFin = new Date(planif.fechaFin);
      const diffDays = Math.ceil(
        (dFin.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (vDto.dias > diffDays) {
        throw new BadRequestException(
          `Los días del viático (${vDto.dias}) no pueden superar los días de la planificación (${diffDays})`,
        );
      }

      const limitPersonas =
        vDto.tipoDestino === 'INSTITUCIONAL'
          ? planif.cantInstitucional
          : planif.cantTerceros;
      if (vDto.cantidadPersonas > limitPersonas) {
        throw new BadRequestException(
          `La cantidad de personas del viático (${vDto.cantidadPersonas}) excede el límite de la planificación (${limitPersonas}) para el tipo ${vDto.tipoDestino}`,
        );
      }

      const precioCatalogo =
        vDto.tipoDestino === 'INSTITUCIONAL'
          ? concepto.precioInstitucional
          : concepto.precioTerceros;

      const montoNetoUnitario = vDto.montoNeto
        ? new Prisma.Decimal(vDto.montoNeto)
        : precioCatalogo;

      const subtotalNeto = montoNetoUnitario
        .mul(vDto.dias)
        .mul(vDto.cantidadPersonas);

      const iva = subtotalNeto.mul(0.13);
      const it = subtotalNeto.mul(0.03);
      const montoPresupuestado = subtotalNeto.add(iva).add(it);

      montoTotalPresupuestado = montoTotalPresupuestado.add(montoPresupuestado);
      montoTotalNeto = montoTotalNeto.add(subtotalNeto);

      viaticosData.push({
        planificacionIndex: vDto.planificacionIndex,
        data: {
          conceptoId: vDto.conceptoId,
          tipoDestino: vDto.tipoDestino,
          dias: vDto.dias,
          cantidadPersonas: vDto.cantidadPersonas,
          costoUnitario: montoNetoUnitario,
          montoPresupuestado: montoPresupuestado,
          iva13: iva,
          it3: it,
          montoNeto: subtotalNeto,
          solicitudPresupuestoId: vDto.solicitudPresupuestoId,
        },
      });
    }

    // --- Procesar Gastos ---
    for (const gDto of gastos) {
      const tipoGasto = tiposGastoMap.get(gDto.tipoGastoId);
      if (!tipoGasto) {
        throw new BadRequestException(
          `Tipo de Gasto con ID ${gDto.tipoGastoId} no existe`,
        );
      }

      const subtotalNeto = new Prisma.Decimal(gDto.montoNeto).mul(
        gDto.cantidad,
      );
      let iva = new Prisma.Decimal(0);
      let it = new Prisma.Decimal(0);
      let iue = new Prisma.Decimal(0);

      if (gDto.tipoDocumento === 'RECIBO') {
        const codigo = tipoGasto.codigo;
        if (codigo === 'COMPRA') {
          iue = subtotalNeto.mul(0.05);
          it = subtotalNeto.mul(0.03);
        } else if (codigo === 'ALQUILER' || codigo === 'SERVICIO') {
          iva = subtotalNeto.mul(0.13);
          it = subtotalNeto.mul(0.03);
        }
      }

      const montoPresupuestado = subtotalNeto.add(iva).add(it).add(iue);

      montoTotalPresupuestado = montoTotalPresupuestado.add(montoPresupuestado);
      montoTotalNeto = montoTotalNeto.add(subtotalNeto);

      gastosData.push({
        solicitudPresupuestoId: gDto.solicitudPresupuestoId,
        tipoGastoId: gDto.tipoGastoId,
        tipoDocumento: gDto.tipoDocumento,
        cantidad: gDto.cantidad,
        costoUnitario: new Prisma.Decimal(gDto.montoNeto),
        montoPresupuestado: montoPresupuestado,
        iva13: iva,
        it3: it,
        iue5: iue,
        montoNeto: subtotalNeto,
        detalle: gDto.detalle,
      });
    }

    return {
      montoTotalPresupuestado,
      montoTotalNeto,
      viaticosData,
      gastosData,
      planificaciones,
      nominasTerceros,
    };
  }

  async create(
    createSolicitudDto: CreateSolicitudDto,
    usuarioId: number,
  ): Promise<Solicitud> {
    const {
      presupuestosIds,
      descripcion,
      aprobadorId,
      lugarViaje,
      motivoViaje,
    } = createSolicitudDto;

    // VALIDACIÓN: Evitar Auto-Aprobación
    if (aprobadorId === usuarioId) {
      throw new BadRequestException(
        'No puedes asignarte a ti mismo como aprobador inicial',
      );
    }

    const detalles = await this.prepararInsertAnidado(createSolicitudDto);

    // 3. TRANSACCIÓN PRISMA
    if (!presupuestosIds || presupuestosIds.length === 0) {
      throw new BadRequestException(
        'Debes seleccionar al menos un presupuesto reservado',
      );
    }

    const codigoSolicitud = await this.generarCodigo();

    const result = await this.prisma.$transaction(async (tx) => {
      // A. Crear Solicitud
      const solicitud = await tx.solicitud.create({
        data: {
          codigoSolicitud,
          descripcion,
          montoTotalPresupuestado: detalles.montoTotalPresupuestado,
          montoTotalNeto: detalles.montoTotalNeto,
          lugarViaje,
          motivoViaje,
          estado: EstadoSolicitud.PENDIENTE,
          usuarioEmisor: { connect: { id: usuarioId } },
          aprobador: { connect: { id: aprobadorId } },
          usuarioBeneficiado: { connect: { id: usuarioId } },
        },
      });

      // B. Confirmar Reservas (Dentro de la misma transacción para evitar P2003)
      await tx.solicitudPresupuesto.updateMany({
        where: {
          id: { in: presupuestosIds },
          usuarioId,
          estado: EstadoReserva.RESERVADO,
        },
        data: {
          estado: EstadoReserva.CONFIRMADO,
          expiresAt: null,
          solicitudId: solicitud.id,
        },
      });

      // C. Crear Planificaciones y mapear IDs
      const createdPlanificaciones: { id: number }[] = [];
      for (const p of detalles.planificaciones) {
        const d1 = new Date(p.fechaInicio);
        const d2 = new Date(p.fechaFin);
        const diff = Math.ceil(
          (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24),
        );

        const cp = await tx.planificacion.create({
          data: {
            actividadProgramada: p.actividad,
            fechaInicio: d1,
            fechaFin: d2,
            diasCalculados: diff,
            cantidadPersonasInstitucional: p.cantInstitucional,
            cantidadPersonasTerceros: p.cantTerceros,
            solicitudId: solicitud.id,
          },
        });
        createdPlanificaciones.push({ id: cp.id });
      }

      // D. Crear Viáticos
      for (const vItem of detalles.viaticosData) {
        await tx.viatico.create({
          data: {
            ...vItem.data,
            solicitudId: solicitud.id,
            planificacionId:
              createdPlanificaciones[vItem.planificacionIndex].id,
          },
        });
      }

      // E. Crear Gastos
      for (const gRecord of detalles.gastosData) {
        await tx.gasto.create({
          data: {
            ...gRecord,
            solicitudId: solicitud.id,
          },
        });
      }

      // F. Crear Nómina
      for (const n of detalles.nominasTerceros) {
        await tx.nominaTerceros.create({
          data: {
            nombreCompleto: n.nombreCompleto,
            ci: n.ci,
            solicitudId: solicitud.id,
          },
        });
      }

      return tx.solicitud.findUnique({
        where: { id: solicitud.id },
        include: {
          planificaciones: true,
          viaticos: true,
          gastos: true,
          nominasTerceros: true,
          usuarioEmisor: true,
          aprobador: true,
          presupuestos: {
            include: {
              poa: { include: { actividad: true } },
            },
          },
        },
      });
    });

    if (!result) {
      throw new BadRequestException('Fallo al crear la solicitud');
    }

    return result;
  }

  async findAll(usuario: { id: number; rol: Rol }): Promise<Solicitud[]> {
    const where: Prisma.SolicitudWhereInput = { deletedAt: null };

    if (usuario.rol === Rol.USUARIO) {
      where.OR = [{ usuarioEmisorId: usuario.id }, { aprobadorId: usuario.id }];
    }

    return this.prisma.solicitud.findMany({
      where,
      include: {
        usuarioEmisor: true,
        aprobador: true,
        presupuestos: {
          include: {
            poa: {
              include: {
                actividad: true,
              },
            },
          },
        },
      },
      orderBy: {
        fechaSolicitud: 'desc',
      },
    });
  }

  async findOne(id: number): Promise<Solicitud> {
    const solicitud = await this.prisma.solicitud.findFirst({
      where: { id, deletedAt: null },
      include: {
        usuarioEmisor: true,
        aprobador: true,
        presupuestos: {
          include: {
            poa: {
              include: {
                actividad: true,
                estructura: { include: { proyecto: true } },
                codigoPresupuestario: true,
              },
            },
          },
        },
        planificaciones: true,
        viaticos: { include: { concepto: true } },
        gastos: { include: { tipoGasto: true } },
        nominasTerceros: true,
      },
    });

    if (!solicitud) {
      throw new NotFoundException(`Solicitud con ID ${id} no encontrada`);
    }

    return solicitud;
  }

  async update(
    id: number,
    updateSolicitudDto: UpdateSolicitudDto,
    usuarioId: number,
  ): Promise<Solicitud> {
    const solicitud = await this.findOne(id);

    // REGLA: Solo el creador puede editar
    if (solicitud.usuarioEmisorId !== usuarioId) {
      throw new ForbiddenException(
        'Solo el creador puede editar esta solicitud',
      );
    }

    // REGLA: Solo si está OBSERVADO
    if (solicitud.estado !== EstadoSolicitud.OBSERVADO) {
      throw new BadRequestException(
        'Solo se pueden editar solicitudes en estado OBSERVADO',
      );
    }

    const {
      aprobadorId,
      lugarViaje,
      motivoViaje,
      descripcion,
      planificaciones,
      viaticos,
      gastos,
      nominasTerceros,
    } = updateSolicitudDto;

    // VALIDACIÓN 2: Mandatory Approver on Subsanación
    if (aprobadorId === undefined) {
      throw new BadRequestException(
        'Debes asignar un aprobador para subsanar la observación',
      );
    }

    // VALIDACIÓN: Evitar Auto-Aprobación en Update
    if (aprobadorId === usuarioId) {
      throw new BadRequestException(
        'No puedes asignarte a ti mismo como aprobador',
      );
    }

    // [SAFETY CHECK] Conditional Nuke: Solo reemplazamos si se envían planes/viaticos/gastos/nominas
    const itemsActualizados =
      (planificaciones && planificaciones.length > 0) ||
      (viaticos && viaticos.length > 0) ||
      (gastos && gastos.length > 0) ||
      (nominasTerceros && nominasTerceros.length > 0);

    return this.prisma.$transaction(async (tx) => {
      let finalMontoTotalPresupuestado = solicitud.montoTotalPresupuestado;
      let finalMontoTotalNeto = solicitud.montoTotalNeto;

      if (itemsActualizados) {
        // A. Limpiar existentes
        await tx.viatico.deleteMany({ where: { solicitudId: id } });
        await tx.gasto.deleteMany({ where: { solicitudId: id } });
        await tx.nominaTerceros.deleteMany({ where: { solicitudId: id } });
        await tx.planificacion.deleteMany({ where: { solicitudId: id } });

        // B. Recalcular y re-insertar
        const detalles = await this.prepararInsertAnidado(updateSolicitudDto);
        finalMontoTotalPresupuestado = detalles.montoTotalPresupuestado;
        finalMontoTotalNeto = detalles.montoTotalNeto;

        // C. Re-inserción masiva (exactamente igual que el create)
        const createdPlanif: { id: number }[] = [];
        for (const p of detalles.planificaciones) {
          const d1 = new Date(p.fechaInicio);
          const d2 = new Date(p.fechaFin);
          const cp = await tx.planificacion.create({
            data: {
              actividadProgramada: p.actividad,
              fechaInicio: d1,
              fechaFin: d2,
              diasCalculados: Math.ceil(
                (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24),
              ),
              cantidadPersonasInstitucional: p.cantInstitucional,
              cantidadPersonasTerceros: p.cantTerceros,
              solicitudId: id,
            },
          });
          createdPlanif.push({ id: cp.id });
        }

        for (const v of detalles.viaticosData) {
          await tx.viatico.create({
            data: {
              ...v.data,
              solicitudId: id,
              planificacionId: createdPlanif[v.planificacionIndex].id,
            },
          });
        }

        for (const g of detalles.gastosData) {
          await tx.gasto.create({
            data: { ...g, solicitudId: id },
          });
        }

        for (const n of detalles.nominasTerceros) {
          await tx.nominaTerceros.create({
            data: {
              nombreCompleto: n.nombreCompleto,
              ci: n.ci,
              solicitudId: id,
            },
          });
        }
      }

      // D. Actualizar Cabecera
      return tx.solicitud.update({
        where: { id },
        data: {
          lugarViaje,
          motivoViaje,
          descripcion,
          montoTotalPresupuestado: finalMontoTotalPresupuestado,
          montoTotalNeto: finalMontoTotalNeto,
          estado: EstadoSolicitud.PENDIENTE,
          observacion: null,
          aprobador: { connect: { id: aprobadorId } },
        },
        include: {
          usuarioEmisor: true,
          aprobador: true,
          presupuestos: {
            include: {
              poa: { include: { actividad: true } },
            },
          },
          planificaciones: true,
          viaticos: { include: { concepto: true } },
          gastos: { include: { tipoGasto: true } },
          nominasTerceros: true,
        },
      });
    });
  }

  async remove(id: number, usuarioId: number): Promise<Solicitud> {
    const solicitud = await this.findOne(id);

    if (solicitud.usuarioEmisorId !== usuarioId) {
      throw new ForbiddenException(
        'Solo el creador puede eliminar esta solicitud',
      );
    }

    return this.prisma.solicitud.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number): Promise<Solicitud> {
    const solicitud = await this.prisma.solicitud.findUnique({
      where: { id },
    });

    if (!solicitud) {
      throw new NotFoundException(`Solicitud con ID ${id} no encontrada`);
    }

    return this.prisma.solicitud.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async aprobar(
    id: number,
    usuarioId: number,
    aprobarDto: AprobarSolicitudDto,
  ): Promise<Solicitud> {
    const solicitud = await this.findOne(id);

    if (solicitud.aprobadorId !== usuarioId) {
      throw new ForbiddenException(
        'No tienes permiso para derivar esta solicitud, no eres el aprobador asignado',
      );
    }

    if (solicitud.estado !== EstadoSolicitud.PENDIENTE) {
      throw new BadRequestException(
        'La solicitud debe estar en estado PENDIENTE para ser derivada',
      );
    }

    const { nuevoAprobadorId } = aprobarDto;

    // Verificar que el nuevo aprobador existe
    const nuevoAprobador = await this.prisma.usuario.findUnique({
      where: { id: nuevoAprobadorId },
    });

    if (!nuevoAprobador) {
      throw new NotFoundException(
        `El nuevo aprobador con ID ${nuevoAprobadorId} no existe`,
      );
    }

    return this.prisma.solicitud.update({
      where: { id },
      data: { aprobadorId: nuevoAprobadorId },
    });
  }

  async observar(
    id: number,
    usuarioId: number,
    observarDto: ObservarSolicitudDto,
  ): Promise<Solicitud> {
    const solicitud = await this.findOne(id);

    if (solicitud.aprobadorId !== usuarioId) {
      throw new ForbiddenException(
        'No tienes permiso para observar esta solicitud',
      );
    }

    if (solicitud.estado !== EstadoSolicitud.PENDIENTE) {
      throw new BadRequestException(
        'Solo se pueden observar solicitudes en estado PENDIENTE',
      );
    }

    return this.prisma.solicitud.update({
      where: { id },
      data: {
        estado: EstadoSolicitud.OBSERVADO,
        observacion: observarDto.observacion,
        aprobadorId: solicitud.usuarioEmisorId, // Se devuelve al dueño
      },
    });
  }

  async desembolsar(
    id: number,
    usuario: { id: number; rol: Rol },
    desembolsarDto: DesembolsarSolicitudDto,
  ): Promise<Solicitud> {
    if (usuario.rol !== Rol.TESORERO && usuario.rol !== Rol.ADMIN) {
      throw new ForbiddenException(
        'Solo el personal de Tesorería o Administración puede desembolsar',
      );
    }

    const solicitud = await this.findOne(id);

    if (solicitud.estado !== EstadoSolicitud.PENDIENTE) {
      throw new BadRequestException(
        'La solicitud debe estar en estado PENDIENTE para ser desembolsada',
      );
    }

    return this.prisma.solicitud.update({
      where: { id },
      data: {
        estado: EstadoSolicitud.DESEMBOLSADO,
        codigoDesembolso: desembolsarDto.codigoDesembolso,
        aprobadorId: null, // Finalizado
      },
    });
  }
}
