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
import { Rol, EstadoSolicitud, Solicitud, Prisma } from '@prisma/client';

@Injectable()
export class SolicitudesService {
  constructor(private prisma: PrismaService) {}

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

  async create(
    createSolicitudDto: CreateSolicitudDto,
    usuarioId: number,
  ): Promise<Solicitud> {
    const {
      poaId,
      descripcion,
      aprobadorId,
      lugarViaje,
      motivoViaje,
      planificaciones = [],
      viaticos = [],
      gastos = [],
      nominasTerceros = [],
    } = createSolicitudDto;

    // VALIDACIÓN: Evitar Auto-Aprobación
    if (aprobadorId === usuarioId) {
      throw new BadRequestException(
        'No puedes asignarte a ti mismo como aprobador inicial',
      );
    }

    // 1. PRE-CARGA DE CATÁLOGOS (Optimización O(1))
    const [conceptosRaw, tiposGastoRaw] = await Promise.all([
      this.prisma.concepto.findMany(),
      this.prisma.tipoGasto.findMany(),
    ]);

    const conceptosMap = new Map(conceptosRaw.map((c) => [c.id, c]));
    const tiposGastoMap = new Map(tiposGastoRaw.map((tg) => [tg.id, tg]));

    // 2. CÁLCULOS PREVIOS Y VALIDACIONES
    let montoTotalSolicitud = new Prisma.Decimal(0);
    let liquidoTotalSolicitud = new Prisma.Decimal(0);

    // Preparar arrays de datos para inserción masiva/transaccional
    const viaticosParaInsertar: {
      data: Omit<
        Prisma.ViaticoUncheckedCreateInput,
        'solicitudId' | 'planificacionId'
      >;
      planificacionIndex: number;
    }[] = [];

    const gastosParaInsertar: Omit<
      Prisma.GastoUncheckedCreateInput,
      'solicitudId'
    >[] = [];

    // --- Procesar Viáticos ---
    for (const vDto of viaticos) {
      const concepto = conceptosMap.get(vDto.conceptoId);
      if (!concepto) {
        throw new BadRequestException(
          `Concepto con ID ${vDto.conceptoId} no existe`,
        );
      }

      // Validar índice de planificación
      const planif = planificaciones[vDto.planificacionIndex];
      if (!planif) {
        throw new BadRequestException(
          `Índice de planificación ${vDto.planificacionIndex} es inválido`,
        );
      }

      // [VALIDACIÓN CRÍTICA] Límites contra Planificación
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

      // Cálculos Financieros (Decimal)
      const precio =
        vDto.tipoDestino === 'INSTITUCIONAL'
          ? concepto.precioInstitucional
          : concepto.precioTerceros;
      const subtotal = precio.mul(vDto.dias).mul(vDto.cantidadPersonas);
      const iva = subtotal.mul(0.13);
      const it = subtotal.mul(0.03);
      const liquido = subtotal.sub(iva).sub(it);

      montoTotalSolicitud = montoTotalSolicitud.add(subtotal);
      liquidoTotalSolicitud = liquidoTotalSolicitud.add(liquido);

      viaticosParaInsertar.push({
        planificacionIndex: vDto.planificacionIndex,
        data: {
          conceptoId: vDto.conceptoId,
          tipoDestino: vDto.tipoDestino,
          dias: vDto.dias,
          cantidadPersonas: vDto.cantidadPersonas,
          costoUnitario: precio,
          totalBs: subtotal,
          iva13: iva,
          it3: it,
          liquidoPagable: liquido,
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

      const subtotal = new Prisma.Decimal(gDto.costoUnitario).mul(
        gDto.cantidad,
      );
      let iva = new Prisma.Decimal(0);
      let it = new Prisma.Decimal(0);
      let iue = new Prisma.Decimal(0);

      if (gDto.tipoDocumento === 'RECIBO') {
        const codigo = tipoGasto.codigo;
        if (codigo === 'COMPRA') {
          iue = subtotal.mul(0.05);
          it = subtotal.mul(0.03);
        } else if (codigo === 'ALQUILER' || codigo === 'SERVICIO') {
          iva = subtotal.mul(0.13);
          it = subtotal.mul(0.03);
        }
      }

      const liquido = subtotal.sub(iva).sub(it).sub(iue);

      montoTotalSolicitud = montoTotalSolicitud.add(subtotal);
      liquidoTotalSolicitud = liquidoTotalSolicitud.add(liquido);

      gastosParaInsertar.push({
        grupoId: gDto.grupoId,
        partidaId: gDto.partidaId,
        tipoGastoId: gDto.tipoGastoId,
        tipoDocumento: gDto.tipoDocumento,
        cantidad: gDto.cantidad,
        costoUnitario: new Prisma.Decimal(gDto.costoUnitario),
        totalBs: subtotal,
        iva13: iva,
        it3: it,
        iue5: iue,
        liquidoPagable: liquido,
        detalle: gDto.detalle,
      });
    }

    // 3. TRANSACCIÓN PRISMA
    const poa = await this.prisma.poa.findUnique({ where: { id: poaId } });
    if (!poa) throw new NotFoundException(`POA ${poaId} no encontrado`);

    const poaOcupado = await this.prisma.solicitud.findFirst({
      where: { poaId, deletedAt: null },
    });
    if (poaOcupado) {
      throw new BadRequestException(
        'El ítem del POA ya está asociado a otra solicitud activa',
      );
    }

    const codigoSolicitud = await this.generarCodigo();

    const result = await this.prisma.$transaction(async (tx) => {
      // A. Crear Solicitud
      const solicitud = await tx.solicitud.create({
        data: {
          codigoSolicitud,
          descripcion,
          montoTotal: montoTotalSolicitud,
          liquidoPagable: liquidoTotalSolicitud,
          lugarViaje,
          motivoViaje,
          estado: EstadoSolicitud.PENDIENTE,
          usuarioEmisor: { connect: { id: usuarioId } },
          aprobador: { connect: { id: aprobadorId } },
          usuarioBeneficiado: { connect: { id: usuarioId } },
          poa: { connect: { id: poaId } },
        },
      });

      // B. Crear Planificaciones y mapear IDs
      const createdPlanificaciones: { id: number }[] = [];
      for (const p of planificaciones) {
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

      // C. Crear Viáticos
      for (const vItem of viaticosParaInsertar) {
        await tx.viatico.create({
          data: {
            ...vItem.data,
            solicitudId: solicitud.id,
            planificacionId:
              createdPlanificaciones[vItem.planificacionIndex].id,
          },
        });
      }

      // D. Crear Gastos
      for (const gRecord of gastosParaInsertar) {
        await tx.gasto.create({
          data: {
            ...gRecord,
            solicitudId: solicitud.id,
          },
        });
      }

      // E. Crear Nómina
      for (const n of nominasTerceros) {
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
          poa: { include: { actividad: true } },
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
        poa: {
          include: {
            actividad: true,
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
        poa: { include: { actividad: true } },
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

    const { aprobadorId, poaId, lugarViaje, motivoViaje, descripcion } =
      updateSolicitudDto;

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

    // VALIDACIÓN 3: POA Uniqueness Check (Excluyendo actual)
    if (poaId !== undefined && poaId !== solicitud.poaId) {
      const poaOcupado = await this.prisma.solicitud.findFirst({
        where: {
          poaId,
          id: { not: id },
          deletedAt: null,
        },
      });

      if (poaOcupado) {
        throw new BadRequestException(
          'El ítem del POA seleccionado ya está asociado a otra solicitud activa',
        );
      }
    }

    const data: Prisma.SolicitudUpdateInput = {
      lugarViaje,
      motivoViaje,
      descripcion,
      estado: EstadoSolicitud.PENDIENTE,
      observacion: null, // Limpiamos la observación al relanzar
      aprobador: { connect: { id: aprobadorId } },
    };

    if (poaId !== undefined) {
      data.poa = { connect: { id: poaId } };
    }

    return this.prisma.solicitud.update({
      where: { id },
      data,
      include: {
        usuarioEmisor: true,
        aprobador: true,
        poa: { include: { actividad: true } },
        planificaciones: true,
        viaticos: { include: { concepto: true } },
        gastos: { include: { tipoGasto: true } },
        nominasTerceros: true,
      },
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
