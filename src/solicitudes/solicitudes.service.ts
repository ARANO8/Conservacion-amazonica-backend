import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSolicitudDto,
  CreatePlanificacionDto,
  CreateNominaDto,
  CreateHospedajeDto,
} from './dto/create-solicitud.dto';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto';
import { AprobarSolicitudDto } from './dto/aprobar-solicitud.dto';
import { ObservarSolicitudDto } from './dto/observar-solicitud.dto';
import { DesembolsarSolicitudDto } from './dto/desembolsar-solicitud.dto';
import {
  Rol,
  EstadoSolicitud,
  Solicitud,
  Prisma,
  TipoAccionHistorial,
} from '@prisma/client';
import { SolicitudPresupuestoService } from '../solicitudes-presupuestos/solicitudes-presupuestos.service';
import { Inject, forwardRef } from '@nestjs/common';
import {
  calcularMontosGastos,
  calcularMontosHospedaje,
  calcularMontosViaticos,
  validarLimitesViatico,
} from './solicitudes.helper';
import { SOLICITUD_INCLUDE } from './solicitudes.constants';
import { PoaService } from '../poa/poa.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PdfService } from '../pdf/pdf.service';

type DetalleSolicitud = {
  montoTotalPresupuestado: Prisma.Decimal;
  montoTotalNeto: Prisma.Decimal;
  viaticosData: {
    data: Omit<
      Prisma.ViaticoUncheckedCreateInput,
      'solicitudId' | 'solicitudPresupuestoId'
    >;
    planificacionIndexes: number[];
    poaId: number;
  }[];
  gastosData: {
    data: Omit<
      Prisma.GastoUncheckedCreateInput,
      'solicitudId' | 'solicitudPresupuestoId'
    >;
    poaId: number;
  }[];
  planificaciones: CreatePlanificacionDto[];
  nominasTerceros: CreateNominaDto[];
  hospedajes: CreateHospedajeDto[];
};

type SolicitudConRelaciones = Prisma.SolicitudGetPayload<{
  include: typeof SOLICITUD_INCLUDE;
}>;

const ESTADOS_COMPROMISO_ACTIVO: EstadoSolicitud[] = [
  // En este dominio no existe EstadoSolicitud.APROBADO explícito.
  // PENDIENTE representa solicitudes activas previas al desembolso.
  EstadoSolicitud.PENDIENTE,
  EstadoSolicitud.DESEMBOLSADO,
];

@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => SolicitudPresupuestoService))
    private presupuestoService: SolicitudPresupuestoService,
    private poaService: PoaService,
    private notificacionesService: NotificacionesService,
    private readonly pdfService: PdfService,
  ) {}

  private async generarCodigo(tx: Prisma.TransactionClient): Promise<string> {
    const anioActual = new Date().getFullYear();
    const count = await tx.solicitud.count({
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
  ): Promise<DetalleSolicitud> {
    const {
      planificaciones = [],
      viaticos = [],
      gastos = [],
      nominasTerceros = [],
      hospedajes = [],
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
        'solicitudId' | 'solicitudPresupuestoId'
      >;
      planificacionIndexes: number[];
      poaId: number;
    }[] = [];

    const gastosData: {
      data: Omit<
        Prisma.GastoUncheckedCreateInput,
        'solicitudId' | 'solicitudPresupuestoId'
      >;
      poaId: number;
    }[] = [];

    // --- Procesar Viáticos ---
    for (const vDto of viaticos) {
      const concepto = conceptosMap.get(vDto.conceptoId);
      if (!concepto) {
        throw new BadRequestException(
          `Concepto con ID ${vDto.conceptoId} no existe`,
        );
      }

      for (const idx of vDto.planificacionIndexes) {
        if (!planificaciones[idx]) {
          throw new BadRequestException(
            `Índice de planificación ${idx} es inválido`,
          );
        }
      }

      // Validamos la capacidad contra cada planificación referenciada por el viático
      for (const idx of vDto.planificacionIndexes) {
        validarLimitesViatico(vDto, planificaciones[idx]);
      }

      const precioCatalogo =
        vDto.tipoDestino === 'INSTITUCIONAL'
          ? concepto.precioInstitucional
          : concepto.precioTerceros;

      // montoNeto (si se provee) es el VALOR TOTAL (días * personas * unitario).
      // Derivamos el precio unitario para los cálculos de impuestos y almacenamiento.
      const divisorUnidad = vDto.dias * vDto.cantidadPersonas;
      const costoUnitario: Prisma.Decimal =
        vDto.montoNeto != null
          ? divisorUnidad > 0
            ? new Prisma.Decimal(vDto.montoNeto).div(divisorUnidad)
            : new Prisma.Decimal(vDto.montoNeto)
          : precioCatalogo;

      const {
        subtotalNeto,
        iva,
        it,
        montoPresupuestado: calcMontoPresupuestado,
      } = calcularMontosViaticos(
        costoUnitario,
        vDto.dias,
        vDto.cantidadPersonas,
        vDto.tipoDestino,
      );

      // montoNeto provisto es el TOTAL; si no se provee, usamos el subtotal calculado
      const finalMontoNeto =
        vDto.montoNeto != null
          ? new Prisma.Decimal(vDto.montoNeto)
          : subtotalNeto;
      const finalMontoPresupuestado = vDto.montoPresupuestado
        ? new Prisma.Decimal(vDto.montoPresupuestado)
        : calcMontoPresupuestado;

      montoTotalPresupuestado = montoTotalPresupuestado.add(
        finalMontoPresupuestado,
      );
      montoTotalNeto = montoTotalNeto.add(finalMontoNeto);

      viaticosData.push({
        planificacionIndexes: vDto.planificacionIndexes,
        poaId: vDto.poaId,
        data: {
          conceptoId: vDto.conceptoId,
          tipoDestino: vDto.tipoDestino,
          dias: vDto.dias,
          cantidadPersonas: vDto.cantidadPersonas,
          costoUnitario: costoUnitario,
          montoPresupuestado: finalMontoPresupuestado,
          iva13: iva,
          it3: it,
          montoNeto: finalMontoNeto,
        },
      });
    }

    // --- Procesar Hospedajes ---
    const hospedajesData: CreateHospedajeDto[] = [];
    for (const hDto of hospedajes) {
      const tipoDocumento = hDto.tipoDocumento ?? 'RECIBO';
      const costoTotal = new Prisma.Decimal(hDto.costoTotal);
      const { iva, it, montoPresupuestado } = calcularMontosHospedaje(
        costoTotal,
        tipoDocumento,
      );

      montoTotalPresupuestado = montoTotalPresupuestado.add(montoPresupuestado);
      montoTotalNeto = montoTotalNeto.add(costoTotal);

      hospedajesData.push({
        ...hDto,
        tipoDocumento,
        iva: Number(iva.toString()),
        it: Number(it.toString()),
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

      const netoTotalDto = new Prisma.Decimal(gDto.montoNeto);

      const {
        iva,
        it,
        iue,
        montoPresupuestado: calcMontoPresupuestado,
      } = calcularMontosGastos(
        netoTotalDto,
        1, // Tratamos el monto del DTO como el total final para el cálculo de impuestos
        gDto.tipoDocumento,
        tipoGasto.codigo,
      );

      // El DTO ya envía el TOTAL (no el unitario), evitamos multiplicar de nuevo
      const finalMontoNeto = netoTotalDto;
      const finalMontoPresupuestado = gDto.montoPresupuestado
        ? new Prisma.Decimal(gDto.montoPresupuestado)
        : calcMontoPresupuestado;

      // Calculo del unitario para la base de datos (Guard Clause contra división por cero)
      const costoUnitarioReal =
        gDto.cantidad > 0 ? netoTotalDto.div(gDto.cantidad) : netoTotalDto;

      montoTotalPresupuestado = montoTotalPresupuestado.add(
        finalMontoPresupuestado,
      );
      montoTotalNeto = montoTotalNeto.add(finalMontoNeto);

      gastosData.push({
        poaId: gDto.poaId,
        data: {
          tipoGastoId: gDto.tipoGastoId,
          tipoDocumento: gDto.tipoDocumento,
          cantidad: gDto.cantidad,
          costoUnitario: costoUnitarioReal,
          montoPresupuestado: finalMontoPresupuestado,
          iva13: iva,
          it3: it,
          iue5: iue,
          montoNeto: finalMontoNeto,
          detalle: gDto.detalle,
        },
      });
    }

    return {
      montoTotalPresupuestado,
      montoTotalNeto,
      viaticosData,
      gastosData,
      planificaciones,
      nominasTerceros,
      hospedajes: hospedajesData,
    };
  }

  private async insertarRelacionesSolicitud(
    solicitudId: number,
    detalles: DetalleSolicitud,
    presupuestosMap: Map<number, number>,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    // C. Crear Planificaciones y mapear IDs
    const createdPlanificaciones: { id: number }[] = [];
    for (const p of detalles.planificaciones) {
      const d1 = new Date(p.fechaInicio);
      const d2 = new Date(p.fechaFin);
      const diferenciaMilisegundos = d2.getTime() - d1.getTime();
      const diasExactos = diferenciaMilisegundos / (1000 * 60 * 60 * 24);
      const diasFinales =
        p.dias !== undefined && p.dias !== null
          ? Number(p.dias)
          : Number(diasExactos.toFixed(2));

      this.logger.log(
        `[insertarRelaciones] Creando Planificacion: actividad="${p.actividad}", fechaInicio=${p.fechaInicio}, fechaFin=${p.fechaFin}, diasFinales=${diasFinales}`,
      );
      const cp = await tx.planificacion.create({
        data: {
          actividadProgramada: p.actividad,
          fechaInicio: d1,
          fechaFin: d2,
          diasCalculados: diasFinales,
          cantidadPersonasInstitucional: p.cantInstitucional,
          cantidadPersonasTerceros: p.cantTerceros,
          solicitudId,
        },
      });
      createdPlanificaciones.push({ id: cp.id });
      this.logger.log(
        `[insertarRelaciones] Planificacion creada OK (id=${cp.id})`,
      );
    }

    // D. Crear Viáticos
    for (let idx = 0; idx < detalles.viaticosData.length; idx++) {
      const vItem = detalles.viaticosData[idx];
      const spId = presupuestosMap.get(vItem.poaId);
      this.logger.log(
        `[insertarRelaciones] Creando Viatico ${idx}: poaId=${vItem.poaId}, spId=${spId}, planificacionIndexes=${JSON.stringify(vItem.planificacionIndexes)}, data=${JSON.stringify(vItem.data)}`,
      );
      await tx.viatico.create({
        data: {
          ...vItem.data,
          solicitudId,
          solicitudPresupuestoId: presupuestosMap.get(vItem.poaId)!,
          planificaciones: {
            connect: vItem.planificacionIndexes.map((i) => ({
              id: createdPlanificaciones[i].id,
            })),
          },
        },
      });
      this.logger.log(`[insertarRelaciones] Viatico ${idx} creado OK`);
    }

    // E. Crear Hospedajes
    for (let idx = 0; idx < detalles.hospedajes.length; idx++) {
      const h = detalles.hospedajes[idx];
      this.logger.log(
        `[insertarRelaciones] Creando Hospedaje ${idx}: ${JSON.stringify(h)}`,
      );
      await tx.hospedaje.create({
        data: {
          ...h,
          solicitudId,
        },
      });
      this.logger.log(`[insertarRelaciones] Hospedaje ${idx} creado OK`);
    }

    // E. Crear Gastos
    for (let idx = 0; idx < detalles.gastosData.length; idx++) {
      const gRecord = detalles.gastosData[idx];
      const spId = presupuestosMap.get(gRecord.poaId);
      this.logger.log(
        `[insertarRelaciones] Creando Gasto ${idx}: poaId=${gRecord.poaId}, spId=${spId}, data=${JSON.stringify(gRecord.data)}`,
      );
      await tx.gasto.create({
        data: {
          ...gRecord.data,
          solicitudId,
          solicitudPresupuestoId: presupuestosMap.get(gRecord.poaId)!,
        },
      });
      this.logger.log(`[insertarRelaciones] Gasto ${idx} creado OK`);
    }

    // F. Crear PersonaExterna (viene de nominasTerceros)
    for (const n of detalles.nominasTerceros) {
      this.logger.log(
        `[insertarRelaciones] Creando PersonaExterna: ${n.nombreCompleto}`,
      );
      await tx.personaExterna.create({
        data: {
          nombreCompleto: n.nombreCompleto.trim().toUpperCase(),
          procedenciaInstitucion: n.procedenciaInstitucion.trim().toUpperCase(),
          solicitudId,
        },
      });
    }
  }

  async create(
    createSolicitudDto: CreateSolicitudDto,
    usuarioId: number,
  ): Promise<Solicitud> {
    const {
      poaIds,
      descripcion,
      aprobadorId,
      lugarViaje,
      motivoViaje,
      urlCuadroComparativo,
      urlCotizaciones,
    } = createSolicitudDto;

    this.logger.log(
      `[create] INICIO — usuarioId=${usuarioId}, aprobadorId=${aprobadorId}, poaIds=${JSON.stringify(poaIds)}`,
    );

    // VALIDACIÓN: Evitar Auto-Aprobación
    if (aprobadorId === usuarioId) {
      throw new BadRequestException(
        'No puedes asignarte a ti mismo como aprobador inicial',
      );
    }

    // VALIDACIÓN: El aprobador no debe ser un usuario eliminado (soft-delete guard)
    const aprobador = await this.prisma.usuario.findFirst({
      where: { id: aprobadorId, deletedAt: null },
    });
    if (!aprobador) {
      throw new NotFoundException(
        `El aprobador con ID ${aprobadorId} no existe o ha sido eliminado del sistema`,
      );
    }

    this.logger.log(`[create] Aprobador validado OK (id=${aprobadorId})`);

    const detalles = await this.prepararInsertAnidado(createSolicitudDto);

    this.logger.log(
      `[create] prepararInsertAnidado OK — viaticosData=${detalles.viaticosData.length}, gastosData=${detalles.gastosData.length}, hospedajes=${detalles.hospedajes.length}, planificaciones=${detalles.planificaciones.length}`,
    );
    this.logger.log(
      `[create] montoTotalPresupuestado=${detalles.montoTotalPresupuestado.toString()}, montoTotalNeto=${detalles.montoTotalNeto.toString()}`,
    );

    // --- CÁLCULO DE FECHAS (Strict Separation) ---
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    if (detalles.planificaciones && detalles.planificaciones.length > 0) {
      minDate = detalles.planificaciones.reduce(
        (min, p) => {
          const current = new Date(p.fechaInicio);
          return !min || current < min ? current : min;
        },
        null as Date | null,
      );

      maxDate = detalles.planificaciones.reduce(
        (max, p) => {
          const current = new Date(p.fechaFin);
          return !max || current > max ? current : max;
        },
        null as Date | null,
      );
    }

    // 3. TRANSACCIÓN PRISMA
    if (!poaIds || poaIds.length === 0) {
      throw new BadRequestException(
        'Debes seleccionar al menos una partida presupuestaria',
      );
    }

    // VALIDACIÓN: Todos los poaIds referenciados en viáticos, gastos y hospedajes
    // deben estar incluidos en el array poaIds enviado en la solicitud.
    const poaIdSet = new Set(poaIds);
    for (const v of detalles.viaticosData) {
      if (!poaIdSet.has(v.poaId)) {
        throw new BadRequestException(
          `El viático referencia la partida POA ${v.poaId} que no está incluida en poaIds`,
        );
      }
    }
    for (const g of detalles.gastosData) {
      if (!poaIdSet.has(g.poaId)) {
        throw new BadRequestException(
          `El gasto referencia la partida POA ${g.poaId} que no está incluida en poaIds`,
        );
      }
    }
    for (const h of detalles.hospedajes) {
      if (!poaIdSet.has(h.poaId)) {
        throw new BadRequestException(
          `El hospedaje referencia la partida POA ${h.poaId} que no está incluida en poaIds`,
        );
      }
    }

    // Calcular monto solicitado por POA (viáticos + gastos + hospedajes)
    const montosByPoa = new Map<number, Prisma.Decimal>();
    for (const v of detalles.viaticosData) {
      const prev = montosByPoa.get(v.poaId) ?? new Prisma.Decimal(0);
      montosByPoa.set(
        v.poaId,
        prev.add(v.data.montoPresupuestado as Prisma.Decimal),
      );
    }
    for (const g of detalles.gastosData) {
      const prev = montosByPoa.get(g.poaId) ?? new Prisma.Decimal(0);
      montosByPoa.set(
        g.poaId,
        prev.add(g.data.montoPresupuestado as Prisma.Decimal),
      );
    }
    for (const h of detalles.hospedajes) {
      const prev = montosByPoa.get(h.poaId) ?? new Prisma.Decimal(0);
      const hospPresupuestado = new Prisma.Decimal(h.costoTotal)
        .add(new Prisma.Decimal(h.iva))
        .add(new Prisma.Decimal(h.it));
      montosByPoa.set(h.poaId, prev.add(hospPresupuestado));
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 0. Generar código atómicamente dentro de la transacción (evita race condition P2002)
      const codigoSolicitud = await this.generarCodigo(tx);
      this.logger.log(`[create TX] Código generado: ${codigoSolicitud}`);

      // 0'. Validar saldo disponible por POA antes de comprometer fondos
      for (const [poaId, montoSolicitado] of montosByPoa) {
        const poa = await tx.poa.findUnique({
          where: { id: poaId },
          select: { costoTotal: true, montoEjecutado: true },
        });
        if (!poa) {
          throw new NotFoundException(`POA con ID ${poaId} no encontrado`);
        }
        const comprometidoRaw = await tx.solicitudPresupuesto.aggregate({
          where: {
            poaId,
            solicitud: {
              deletedAt: null,
              estado: { in: ESTADOS_COMPROMISO_ACTIVO },
            },
          },
          _sum: { subtotalPresupuestado: true },
        });
        const comprometido =
          comprometidoRaw._sum.subtotalPresupuestado ?? new Prisma.Decimal(0);
        const saldoDisponible = poa.costoTotal
          .sub(poa.montoEjecutado)
          .sub(comprometido);
        this.logger.log(
          `[create TX] POA ${poaId}: costoTotal=${poa.costoTotal.toString()}, comprometido=${comprometido.toString()}, saldo=${saldoDisponible.toString()}, solicitado=${montoSolicitado.toString()}`,
        );
        if (montoSolicitado.gt(saldoDisponible)) {
          throw new BadRequestException(
            'Saldo insuficiente en el POA especificado',
          );
        }
      }

      // A. Crear Solicitud
      this.logger.log(`[create TX] Creando solicitud...`);
      const solicitud = await tx.solicitud.create({
        data: {
          codigoSolicitud,
          descripcion,
          montoTotalPresupuestado: detalles.montoTotalPresupuestado,
          montoTotalNeto: detalles.montoTotalNeto,
          lugarViaje,
          motivoViaje,
          urlCuadroComparativo,
          urlCotizaciones: urlCotizaciones ?? [],
          fechaInicio: minDate,
          fechaFin: maxDate,
          estado: EstadoSolicitud.PENDIENTE,
          usuarioEmisor: { connect: { id: usuarioId } },
          aprobador: { connect: { id: aprobadorId } },
          usuarioBeneficiado: { connect: { id: usuarioId } },
        },
      });
      this.logger.log(`[create TX] Solicitud creada OK (id=${solicitud.id})`);

      // B. Crear SolicitudPresupuesto (transaccional, save-at-end)
      const presupuestosMap = new Map<number, number>(); // poaId → SolicitudPresupuesto.id
      for (const poaId of poaIds) {
        this.logger.log(
          `[create TX] Creando SolicitudPresupuesto para poaId=${poaId}...`,
        );
        const sp = await tx.solicitudPresupuesto.create({
          data: { poaId, solicitudId: solicitud.id },
        });
        presupuestosMap.set(poaId, sp.id);
        this.logger.log(
          `[create TX] SolicitudPresupuesto creado OK (id=${sp.id}, poaId=${poaId})`,
        );
      }

      // C–F. Insertar relaciones anidadas (planificaciones, viáticos, hospedajes, gastos, nóminas)
      this.logger.log(`[create TX] Insertando relaciones anidadas...`);
      await this.insertarRelacionesSolicitud(
        solicitud.id,
        detalles,
        presupuestosMap,
        tx,
      );
      this.logger.log(`[create TX] Relaciones anidadas OK`);

      // SYNC: Recalcular subtotales de los presupuestos involucrados
      this.logger.log(`[create TX] Recalculando totales...`);
      await this.presupuestoService.recalcularTotales(solicitud.id, tx);
      this.logger.log(`[create TX] Recálculo OK`);

      return tx.solicitud.findUnique({
        where: { id: solicitud.id },
        include: SOLICITUD_INCLUDE,
      });
    });

    if (!result) {
      throw new BadRequestException('Fallo al crear la solicitud');
    }

    // Crear notificación para el aprobador asignado (fire-and-forget seguro)
    try {
      await this.notificacionesService.crearNotificacion({
        titulo: 'Nueva solicitud asignada',
        mensaje: `Se ha asignado la solicitud ${result.codigoSolicitud} para tu aprobación`,
        tipo: 'SOLICITUD_ASIGNADA',
        usuarioId: aprobadorId,
        solicitudId: result.id,
        urlDestino: `/app/aprobaciones/${result.id}`,
      });
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `[SolicitudesService] Error al crear notificación para solicitud ${result.id}: ${normalizedError.message}`,
        normalizedError.stack,
      );
    }

    return result;
  }

  async findAll(
    usuario: {
      id: number;
      rol: Rol;
    },
    partidaId?: number,
  ): Promise<SolicitudConRelaciones[]> {
    const where: Prisma.SolicitudWhereInput = { deletedAt: null };

    if (usuario.rol === Rol.USUARIO) {
      where.OR = [{ usuarioEmisorId: usuario.id }, { aprobadorId: usuario.id }];
    }

    if (partidaId !== undefined) {
      where.presupuestos = {
        some: {
          poa: {
            estructura: {
              partidaId,
            },
          },
        },
      };
    }

    const solicitudes = await this.prisma.solicitud.findMany({
      where,
      include: SOLICITUD_INCLUDE,
      orderBy: {
        fechaSolicitud: 'desc',
      },
    });

    return Promise.all(solicitudes.map((s) => this.enriquecerConSaldos(s)));
  }

  async findOne(id: number) {
    // Una sola consulta con todos los includes necesarios y filtro deletedAt: null
    // Evita la doble consulta anterior y garantiza que las solicitudes borradas
    // (soft-delete) nunca sean expuestas.
    const solicitud = await this.prisma.solicitud.findFirst({
      where: { id, deletedAt: null },
      include: {
        usuarioEmisor: true,
        aprobador: true,
        usuarioBeneficiado: true,
        historialAprobaciones: {
          include: {
            usuario: {
              select: {
                id: true,
                nombreCompleto: true,
                email: true,
                cargo: true,
                rol: true,
              },
            },
            derivadoA: {
              select: {
                id: true,
                nombreCompleto: true,
                email: true,
                cargo: true,
                rol: true,
              },
            },
          },
          orderBy: { fecha: 'desc' },
        },
        presupuestos: {
          include: {
            poa: {
              include: {
                estructura: {
                  include: {
                    proyecto: { include: { cuentaBancaria: true } },
                    grupo: true,
                    partida: true,
                  },
                },
                codigoPresupuestario: true,
                actividad: true,
              },
            },
          },
        },
        planificaciones: true,
        viaticos: {
          include: {
            concepto: true,
            planificaciones: true,
          },
        },
        gastos: { include: { tipoGasto: true } },
        hospedajes: true,
        personasExternas: true,
        nominasTerceros: true,
        rendicion: true,
      },
    });

    if (!solicitud) {
      throw new NotFoundException(`Solicitud con ID ${id} no encontrada`);
    }

    return solicitud;
  }

  async generatePdf(id: number): Promise<Buffer> {
    const solicitud = await this.findOne(id);

    const detalle = [
      ...(solicitud.viaticos ?? []).map((viatico) => ({
        categoria: 'Viático',
        descripcion: viatico.concepto?.nombre ?? viatico.tipoDestino,
        cantidad: `${Number(viatico.dias ?? 0)} días x ${viatico.cantidadPersonas} pers`,
        montoNeto: this.formatCurrency(Number(viatico.montoNeto ?? 0)),
      })),
      ...(solicitud.gastos ?? []).map((gasto) => ({
        categoria: 'Gasto',
        descripcion: gasto.tipoGasto?.nombre ?? gasto.detalle ?? 'Sin detalle',
        cantidad: `${gasto.cantidad}`,
        montoNeto: this.formatCurrency(Number(gasto.montoNeto ?? 0)),
      })),
      ...(solicitud.hospedajes ?? []).map((hospedaje) => ({
        categoria: 'Hospedaje',
        descripcion: hospedaje.destino,
        cantidad: `${hospedaje.noches} noches`,
        montoNeto: this.formatCurrency(Number(hospedaje.costoTotal ?? 0)),
      })),
    ];

    return this.pdfService.generatePdf('solicitud.hbs', {
      ...solicitud,
      codigoSolicitud: solicitud.codigoSolicitud,
      fechaSolicitud: this.formatDate(solicitud.fechaSolicitud),
      fechaInicio: this.formatDate(solicitud.fechaInicio),
      fechaFin: this.formatDate(solicitud.fechaFin),
      montoTotalNeto: this.formatCurrency(
        Number(solicitud.montoTotalNeto ?? 0),
      ),
      montoTotalPresupuestado: this.formatCurrency(
        Number(solicitud.montoTotalPresupuestado ?? 0),
      ),
      emisorNombre: solicitud.usuarioEmisor?.nombreCompleto ?? 'N/A',
      emisorCargo: solicitud.usuarioEmisor?.cargo ?? 'N/A',
      aprobadorNombre: solicitud.aprobador?.nombreCompleto ?? 'Sin asignar',
      motivoViaje: solicitud.motivoViaje ?? 'Sin motivo registrado',
      lugarViaje: solicitud.lugarViaje ?? 'Sin lugar registrado',
      detalle,
    });
  }

  private formatDate(value: Date | string | null | undefined): string {
    if (!value) return 'N/A';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  private formatCurrency(value: number): string {
    return `Bs ${new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`;
  }

  private async enriquecerConSaldos(
    solicitud: SolicitudConRelaciones,
  ): Promise<SolicitudConRelaciones> {
    if (solicitud.presupuestos) {
      await Promise.all(
        solicitud.presupuestos.map(async (sp) => {
          if (sp.poa) {
            sp.poa = await this.poaService.addSaldoDisponible(sp.poa);
          }
        }),
      );
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
      urlCuadroComparativo,
      urlCotizaciones,
      poaIds,
      planificaciones,
      viaticos,
      gastos,
      hospedajes,
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

    // VALIDACIÓN: El aprobador no debe ser un usuario eliminado (soft-delete guard)
    const aprobadorUpdate = await this.prisma.usuario.findFirst({
      where: { id: aprobadorId, deletedAt: null },
    });
    if (!aprobadorUpdate) {
      throw new NotFoundException(
        `El aprobador con ID ${aprobadorId} no existe o ha sido eliminado del sistema`,
      );
    }

    const debeReemplazarRelacionesAnidadas =
      poaIds !== undefined ||
      planificaciones !== undefined ||
      viaticos !== undefined ||
      gastos !== undefined ||
      hospedajes !== undefined ||
      nominasTerceros !== undefined;

    const solicitudActualizada = await this.prisma.$transaction(async (tx) => {
      let finalMontoTotalPresupuestado = solicitud.montoTotalPresupuestado;
      let finalMontoTotalNeto = solicitud.montoTotalNeto;
      let finalFechaInicio: Date | null = solicitud.fechaInicio;
      let finalFechaFin: Date | null = solicitud.fechaFin;

      if (debeReemplazarRelacionesAnidadas) {
        const poaIdsActualizados =
          poaIds ??
          solicitud.presupuestos.map((presupuesto) => presupuesto.poaId);

        if (poaIdsActualizados.length === 0) {
          throw new BadRequestException(
            'Debes seleccionar al menos una partida presupuestaria',
          );
        }

        const dtoParaReemplazo: UpdateSolicitudDto = {
          ...updateSolicitudDto,
          poaIds: poaIdsActualizados,
          planificaciones: planificaciones ?? [],
          viaticos: viaticos ?? [],
          gastos: gastos ?? [],
          hospedajes: hospedajes ?? [],
          nominasTerceros: nominasTerceros ?? [],
        };

        // B. Recalcular y re-insertar
        const detalles = await this.prepararInsertAnidado(dtoParaReemplazo);

        // Validación: todas las referencias por POA deben existir en poaIds
        const poaIdSet = new Set(poaIdsActualizados);
        for (const viatico of detalles.viaticosData) {
          if (!poaIdSet.has(viatico.poaId)) {
            throw new BadRequestException(
              `El viático referencia la partida POA ${viatico.poaId} que no está incluida en poaIds`,
            );
          }
        }

        for (const gasto of detalles.gastosData) {
          if (!poaIdSet.has(gasto.poaId)) {
            throw new BadRequestException(
              `El gasto referencia la partida POA ${gasto.poaId} que no está incluida en poaIds`,
            );
          }
        }

        for (const hospedaje of detalles.hospedajes) {
          if (!poaIdSet.has(hospedaje.poaId)) {
            throw new BadRequestException(
              `El hospedaje referencia la partida POA ${hospedaje.poaId} que no está incluida en poaIds`,
            );
          }
        }

        // A. Limpiar existentes (orden: hijos primero por FK)
        await tx.viatico.deleteMany({ where: { solicitudId: id } });
        await tx.gasto.deleteMany({ where: { solicitudId: id } });
        await tx.hospedaje.deleteMany({ where: { solicitudId: id } });
        await tx.personaExterna.deleteMany({ where: { solicitudId: id } });
        await tx.nominaTerceros.deleteMany({ where: { solicitudId: id } });
        await tx.planificacion.deleteMany({ where: { solicitudId: id } });
        await tx.solicitudPresupuesto.deleteMany({
          where: { solicitudId: id },
        });
        finalMontoTotalPresupuestado = detalles.montoTotalPresupuestado;
        finalMontoTotalNeto = detalles.montoTotalNeto;

        // --- CÁLCULO DE FECHAS (Update - Strict Separation) ---
        if (detalles.planificaciones && detalles.planificaciones.length > 0) {
          finalFechaInicio = detalles.planificaciones.reduce(
            (min, p) => {
              const current = new Date(p.fechaInicio);
              return !min || current < min ? current : min;
            },
            null as Date | null,
          );

          finalFechaFin = detalles.planificaciones.reduce(
            (max, p) => {
              const current = new Date(p.fechaFin);
              return !max || current > max ? current : max;
            },
            null as Date | null,
          );
        } else {
          finalFechaInicio = null;
          finalFechaFin = null;
        }

        // B.5 Recrear SolicitudPresupuesto
        const presupuestosMap = new Map<number, number>();
        for (const poaId of poaIdsActualizados) {
          const sp = await tx.solicitudPresupuesto.create({
            data: { poaId, solicitudId: id },
          });
          presupuestosMap.set(poaId, sp.id);
        }

        // C–F. Re-inserción de relaciones anidadas
        await this.insertarRelacionesSolicitud(
          id,
          detalles,
          presupuestosMap,
          tx,
        );
      }

      // SYNC: Recalcular subtotales de los presupuestos involucrados
      await this.presupuestoService.recalcularTotales(id, tx);

      // D. Actualizar Cabecera
      return tx.solicitud.update({
        where: { id },
        data: {
          lugarViaje,
          motivoViaje,
          descripcion,
          urlCuadroComparativo:
            urlCuadroComparativo !== undefined
              ? urlCuadroComparativo
              : undefined,
          urlCotizaciones:
            urlCotizaciones !== undefined ? urlCotizaciones : undefined,
          montoTotalPresupuestado: finalMontoTotalPresupuestado,
          montoTotalNeto: finalMontoTotalNeto,
          fechaInicio: finalFechaInicio,
          fechaFin: finalFechaFin,
          estado: EstadoSolicitud.PENDIENTE,
          observacion: null,
          aprobador: { connect: { id: aprobadorId } },
        },
        include: SOLICITUD_INCLUDE,
      });
    });

    try {
      await this.notificacionesService.crearNotificacion({
        titulo: 'Solicitud corregida',
        mensaje: `La solicitud ${solicitudActualizada.codigoSolicitud} ha sido corregida y requiere tu revisión`,
        tipo: 'SOLICITUD_ASIGNADA',
        usuarioId: aprobadorId,
        solicitudId: solicitudActualizada.id,
        urlDestino: `/app/aprobaciones/${solicitudActualizada.id}`,
      });
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `[SolicitudesService] Error al crear notificación (corrección) para solicitud ${solicitudActualizada.id}: ${normalizedError.message}`,
        normalizedError.stack,
      );
    }

    return solicitudActualizada;
  }

  async remove(id: number, usuarioId: number): Promise<Solicitud> {
    const solicitud = await this.findOne(id);

    if (solicitud.usuarioEmisorId !== usuarioId) {
      throw new ForbiddenException(
        'Solo el creador puede eliminar esta solicitud',
      );
    }

    if (solicitud.estado === EstadoSolicitud.DESEMBOLSADO) {
      throw new BadRequestException(
        'No se puede eliminar una solicitud que ya ha sido desembolsada',
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

    // Verificar que el nuevo aprobador existe y no está eliminado (soft-delete guard)
    const nuevoAprobador = await this.prisma.usuario.findFirst({
      where: { id: nuevoAprobadorId, deletedAt: null },
    });

    if (!nuevoAprobador) {
      throw new NotFoundException(
        `El nuevo aprobador con ID ${nuevoAprobadorId} no existe o ha sido eliminado del sistema`,
      );
    }

    const solicitudActualizada = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.solicitud.update({
        where: { id },
        data: { aprobadorId: nuevoAprobadorId },
        include: SOLICITUD_INCLUDE,
      });

      // Registrar en historial (dentro de la misma transacción)
      await tx.historialAprobacion.create({
        data: {
          accion: TipoAccionHistorial.DERIVADO,
          solicitudId: id,
          usuarioId,
          derivadoAId: nuevoAprobadorId,
        },
      });

      return updated;
    });

    try {
      // Crear notificación para el nuevo aprobador
      await this.notificacionesService.crearNotificacion({
        titulo: 'Solicitud derivada',
        mensaje: `La solicitud ${solicitudActualizada.codigoSolicitud} ha sido derivada para tu aprobación`,
        tipo: 'SOLICITUD_DERIVADA',
        usuarioId: nuevoAprobadorId,
        solicitudId: solicitudActualizada.id,
        urlDestino: `/app/aprobaciones/${solicitudActualizada.id}`,
      });
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `[SolicitudesService] Error al crear notificación (derivar) para solicitud ${solicitudActualizada.id}: ${normalizedError.message}`,
        normalizedError.stack,
      );
    }

    return solicitudActualizada;
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

    const solicitudActualizada = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.solicitud.update({
        where: { id },
        data: {
          estado: EstadoSolicitud.OBSERVADO,
          observacion: observarDto.observacion,
          aprobadorId: solicitud.usuarioEmisorId, // Se devuelve al dueño
        },
        include: SOLICITUD_INCLUDE,
      });

      // Registrar en historial (dentro de la misma transacción)
      await tx.historialAprobacion.create({
        data: {
          accion: TipoAccionHistorial.OBSERVADO,
          comentario: observarDto.observacion,
          solicitudId: id,
          usuarioId,
          derivadoAId: solicitud.usuarioEmisorId,
        },
      });

      return updated;
    });

    try {
      // Crear notificación para el usuario emisor
      await this.notificacionesService.crearNotificacion({
        titulo: 'Solicitud observada',
        mensaje: `Tu solicitud ${solicitudActualizada.codigoSolicitud} requiere correcciones. Observación: ${observarDto.observacion}`,
        tipo: 'SOLICITUD_OBSERVADA',
        usuarioId: solicitud.usuarioEmisorId,
        solicitudId: solicitudActualizada.id,
        urlDestino: `/app/solicitudes/${id}/editar`,
      });
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `[SolicitudesService] Error al crear notificación (observar) para solicitud ${solicitudActualizada.id}: ${normalizedError.message}`,
        normalizedError.stack,
      );
    }

    return solicitudActualizada;
  }

  async desembolsar(
    id: number,
    usuario: { id: number; rol: Rol },
    desembolsarDto: DesembolsarSolicitudDto,
  ): Promise<Solicitud> {
    if (
      usuario.rol !== Rol.TESORERO &&
      usuario.rol !== Rol.ADMIN &&
      usuario.rol !== Rol.EJECUTIVO
    ) {
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

    const solicitudActualizada = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.solicitud.update({
        where: { id },
        data: {
          estado: EstadoSolicitud.DESEMBOLSADO,
          codigoDesembolso: desembolsarDto.codigoDesembolso,
          urlComprobante: desembolsarDto.urlComprobante ?? null,
          aprobadorId: null, // Finalizado
        },
        include: SOLICITUD_INCLUDE,
      });

      // Registrar en historial (dentro de la misma transacción)
      await tx.historialAprobacion.create({
        data: {
          accion: TipoAccionHistorial.APROBADO,
          comentario: desembolsarDto.codigoDesembolso,
          solicitudId: id,
          usuarioId: usuario.id,
        },
      });

      return updated;
    });

    try {
      // Crear notificación para el usuario emisor
      await this.notificacionesService.crearNotificacion({
        titulo: 'Solicitud desembolsada',
        mensaje: `Tu solicitud ${solicitudActualizada.codigoSolicitud} ha sido desembolsada. Código: ${desembolsarDto.codigoDesembolso}. Procede a registrar tu rendición.`,
        tipo: 'SOLICITUD_APROBADA',
        usuarioId: solicitudActualizada.usuarioEmisorId,
        solicitudId: solicitudActualizada.id,
        urlDestino: `/app/rendiciones/nueva?solicitudId=${id}`,
      });
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `[SolicitudesService] Error al crear notificación (desembolsar) para solicitud ${solicitudActualizada.id}: ${normalizedError.message}`,
        normalizedError.stack,
      );
    }

    return solicitudActualizada;
  }
}
