import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoRendicion,
  EstadoSolicitud,
  Prisma,
  Rol,
  TipoDocumento,
  TipoAccionHistorial,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRendicionDto } from './dto/create-rendicion.dto';
import { UpdateRendicionDto } from './dto/update-rendicion.dto';
import { AprobarRendicionDto } from './dto/aprobar-rendicion.dto';
import { ObservarRendicionDto } from './dto/observar-rendicion.dto';
import { UpdateGastoPartidaContableDto } from './dto/update-gasto-partida-contable.dto';
import { UpdateGastoPartidaPresupuestariaDto } from './dto/update-gasto-partida-presupuestaria.dto';
import { PdfService } from '../pdf/pdf.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { desglosarRetenciones } from './rendiciones.helper';

const RENDICION_INCLUDE = {
  solicitud: {
    include: {
      usuarioEmisor: {
        select: {
          id: true,
          nombreCompleto: true,
          email: true,
          cargo: true,
          rol: true,
        },
      },
      aprobador: {
        select: {
          id: true,
          nombreCompleto: true,
          cargo: true,
          rol: true,
        },
      },
      presupuestos: {
        include: {
          poa: {
            include: {
              estructura: {
                include: {
                  proyecto: true,
                  grupo: true,
                  partida: true,
                },
              },
              actividad: true,
            },
          },
        },
      },
    },
  },
  aprobadorActual: {
    select: {
      id: true,
      nombreCompleto: true,
      rol: true,
      cargo: true,
    },
  },
  gastosRendicion: {
    include: {
      partidaContable: true,
      partida: {
        include: {
          poa: {
            include: {
              estructura: {
                include: {
                  partida: true,
                  proyecto: true,
                  grupo: true,
                },
              },
            },
          },
        },
      },
    },
  },
  informeGastos: {
    include: {
      actividades: true,
    },
  },
  historialAprobaciones: {
    include: {
      usuario: {
        select: {
          id: true,
          nombreCompleto: true,
          rol: true,
          cargo: true,
        },
      },
      derivadoA: {
        select: {
          id: true,
          nombreCompleto: true,
          rol: true,
          cargo: true,
        },
      },
    },
    orderBy: {
      fecha: 'asc',
    },
  },
  declaracionesJuradas: true,
} satisfies Prisma.RendicionInclude;

@Injectable()
export class RendicionesService {
  private readonly logger = new Logger(RendicionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /**
   * Devuelve todas las rendiciones del sistema (para monitores, auditoría, etc.).
   * Solo filtra por deletedAt de la solicitud.
   */
  async findAll(solicitudId?: number, usuario?: { id: number; rol: Rol }) {
    const where: Prisma.RendicionWhereInput = {
      solicitud: {
        deletedAt: null,
      },
    };

    if (solicitudId !== undefined) {
      where.solicitudId = solicitudId;
    }

    // Un USUARIO solo ve rendiciones de solicitudes propias o donde es el
    // aprobador actual. Los roles privilegiados (monitores/auditoría) ven todo.
    if (usuario && usuario.rol === Rol.USUARIO) {
      where.OR = [
        { solicitud: { usuarioEmisorId: usuario.id } },
        { aprobadorActualId: usuario.id },
      ];
    }

    return this.prisma.rendicion.findMany({
      where,
      include: RENDICION_INCLUDE,
      orderBy: { fechaRendicion: 'desc' },
    });
  }

  /**
   * Devuelve únicamente las rendiciones creadas por el usuario actual.
   * (Para "Mis Trámites > Rendiciones")
   */
  async findMisRendiciones(usuarioId: number) {
    return this.prisma.rendicion.findMany({
      where: {
        solicitud: {
          usuarioEmisorId: usuarioId,
          deletedAt: null,
        },
      },
      include: RENDICION_INCLUDE,
      orderBy: { fechaRendicion: 'desc' },
    });
  }

  async findOne(id: number, usuario?: { id: number; rol: Rol }) {
    const rendicion = await this.prisma.rendicion.findFirst({
      where: { id, solicitud: { deletedAt: null } },
      include: RENDICION_INCLUDE,
    });

    if (!rendicion) {
      throw new NotFoundException('Rendición no encontrada');
    }

    this.assertPuedeVerRendicion(rendicion, usuario);

    return rendicion;
  }

  /**
   * Verifica que el usuario pueda acceder a la rendición. Los roles
   * privilegiados ven todo; un USUARIO solo puede ver las rendiciones de las
   * solicitudes que emitió o en las que es el aprobador actual. Sin usuario
   * (contexto interno de confianza) no se valida.
   */
  private assertPuedeVerRendicion(
    rendicion: {
      aprobadorActualId: number | null;
      solicitud: { usuarioEmisorId: number };
    },
    usuario?: { id: number; rol: Rol },
  ): void {
    if (!usuario || usuario.rol !== Rol.USUARIO) {
      return;
    }

    const esEmisor = rendicion.solicitud.usuarioEmisorId === usuario.id;
    const esAprobador = rendicion.aprobadorActualId === usuario.id;

    if (!esEmisor && !esAprobador) {
      throw new ForbiddenException(
        'No tienes permiso para acceder a esta rendición',
      );
    }
  }

  async findBySolicitudId(
    solicitudId: number,
    usuario?: { id: number; rol: Rol },
  ) {
    const rendicion = await this.prisma.rendicion.findFirst({
      where: { solicitudId, solicitud: { deletedAt: null } },
      include: RENDICION_INCLUDE,
    });

    if (!rendicion) {
      throw new NotFoundException(
        'No se encontró una rendición para la solicitud indicada',
      );
    }

    this.assertPuedeVerRendicion(rendicion, usuario);

    return rendicion;
  }

  async generatePdf(
    id: number,
    usuario?: { id: number; rol: Rol },
  ): Promise<Buffer> {
    const rendicion = await this.findOne(id, usuario);

    const montoRecibido = Number(rendicion.solicitud.montoTotalNeto ?? 0);
    const transacciones: any[] = [];
    let runningBalance = montoRecibido;

    // Fila 0: Anticipo Recibido
    transacciones.push({
      fecha: this.formatDate(
        rendicion.solicitud.fechaDesembolso ??
          rendicion.solicitud.fechaSolicitud ??
          rendicion.createdAt,
      ),
      comprobante: rendicion.solicitud.codigoDesembolso
        ? `COMPROBANTE ${rendicion.solicitud.codigoDesembolso}`
        : `SOLICITUD ${rendicion.solicitud.codigoSolicitud}`,
      partida: '—',
      concepto: `Anticipo recibido para: ${rendicion.solicitud.motivoViaje ?? 'Actividades de viaje'}`,
      proveedor: rendicion.solicitud.usuarioEmisor?.nombreCompleto ?? 'N/A',
      ingreso: this.formatCurrency(montoRecibido),
      egreso: '—',
      saldo: this.formatCurrency(runningBalance),
    });

    // Unificar egresos (gastos con respaldo y declaraciones juradas)
    const rawGastos = (rendicion.gastosRendicion ?? []).map((g) => {
      const partidaCod =
        g.partida?.poa?.estructura?.partida?.nombre ??
        g.partida?.poa?.codigoPoa ??
        'S/P';
      const desglose = desglosarRetenciones(
        g.montoImpuestos ?? 0,
        g.tipoDocumento,
        g.tipoRetencion,
        g.partida?.poa?.estructura?.partida?.nombre,
      );

      return {
        date: g.fecha ? new Date(g.fecha) : new Date(rendicion.fechaRendicion),
        fechaStr: this.formatDate(g.fecha),
        comprobante: `${g.tipoDocumento} ${g.nroDocumento}`,
        tipoDocumento: String(g.tipoDocumento),
        partida: partidaCod,
        concepto: g.concepto || g.detalle || 'Gasto con respaldo',
        proveedor: g.proveedor || 'S/P',
        montoBruto: Number(g.montoBruto ?? g.monto ?? 0),
        montoImpuestos: Number(g.montoImpuestos ?? 0),
        montoNeto: Number(g.montoNeto ?? 0),
        rcIva: desglose.rcIva.toNumber(),
        iue: desglose.iue.toNumber(),
        it: desglose.it.toNumber(),
      };
    });

    const rawDeclaraciones = (rendicion.declaracionesJuradas ?? []).map(
      (dj) => {
        return {
          date: dj.fecha
            ? new Date(dj.fecha)
            : new Date(rendicion.fechaRendicion),
          fechaStr: this.formatDate(dj.fecha),
          comprobante: 'DECLARACIÓN JURADA (DJ)',
          partida: 'S/P',
          concepto: dj.detalle || 'Gasto sin respaldo',
          proveedor: rendicion.solicitud.usuarioEmisor?.nombreCompleto ?? 'N/A',
          tipoDocumento: 'DJ',
          montoBruto: Number(dj.monto ?? 0),
          montoImpuestos: 0,
          montoNeto: Number(dj.monto ?? 0),
          rcIva: 0,
          iue: 0,
          it: 0,
        };
      },
    );

    // Ordenar cronológicamente
    const sortedGastos = [...rawGastos, ...rawDeclaraciones].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    let totalEfectivoPagado = 0;
    let totalImpuestosRetenidos = 0;
    let totalPresupuestado = 0;
    let totalRcIva = 0;
    let totalIue = 0;
    let totalIt = 0;

    // Conteo de documentos de respaldo (ANEXO 4): factura vs. el resto
    const conteo = {
      facturasCantidad: 0,
      facturasMonto: 0,
      recibosCantidad: 0,
      recibosMonto: 0,
    };

    for (const g of sortedGastos) {
      // El saldo de caja sigue el efectivo desembolsado, no el bruto que se
      // carga al POA: es la plata que se devuelve o se reembolsa al liquidar.
      runningBalance -= g.montoNeto;

      totalEfectivoPagado += g.montoNeto;
      totalImpuestosRetenidos += g.montoImpuestos;
      totalPresupuestado += g.montoBruto;
      totalRcIva += g.rcIva;
      totalIue += g.iue;
      totalIt += g.it;

      if (g.tipoDocumento === 'FACTURA') {
        conteo.facturasCantidad += 1;
        conteo.facturasMonto += g.montoNeto;
      } else {
        conteo.recibosCantidad += 1;
        conteo.recibosMonto += g.montoNeto;
      }

      transacciones.push({
        fecha: g.fechaStr,
        comprobante: g.comprobante,
        partida: g.partida,
        concepto: g.concepto,
        proveedor: g.proveedor,
        ingreso: '—',
        egreso: this.formatCurrency(g.montoNeto),
        saldo: this.formatCurrency(runningBalance),
        total: this.formatCurrency(g.montoBruto),
        rcIva: g.rcIva > 0 ? this.formatCurrency(g.rcIva) : '—',
        iue: g.iue > 0 ? this.formatCurrency(g.iue) : '—',
        it: g.it > 0 ? this.formatCurrency(g.it) : '—',
        totalImpuestos:
          g.montoImpuestos > 0 ? this.formatCurrency(g.montoImpuestos) : '—',
        neto: this.formatCurrency(g.montoNeto),
      });
    }

    // Liquidación de caja: recibido menos el efectivo gastado
    const saldoEfectivo = Number(
      (montoRecibido - totalEfectivoPagado).toFixed(2),
    );
    const finalSaldoLiquido = saldoEfectivo;

    // Resumen Contable por Partida
    const agrupadoPartidasMap = new Map<
      string,
      {
        codigo: string;
        concepto: string;
        montoNeto: number;
        montoImpuestos: number;
        montoBruto: number;
      }
    >();

    for (const g of sortedGastos) {
      const cod = g.partida;
      const exist = agrupadoPartidasMap.get(cod);
      if (exist) {
        exist.montoNeto += g.montoNeto;
        exist.montoImpuestos += g.montoImpuestos;
        exist.montoBruto += g.montoBruto;
      } else {
        agrupadoPartidasMap.set(cod, {
          codigo: cod,
          concepto: g.concepto,
          montoNeto: g.montoNeto,
          montoImpuestos: g.montoImpuestos,
          montoBruto: g.montoBruto,
        });
      }
    }

    const resumenContable = Array.from(agrupadoPartidasMap.values()).map(
      (r) => ({
        codigo: r.codigo,
        concepto: r.concepto,
        montoNeto: this.formatCurrency(r.montoNeto),
        montoImpuestos: this.formatCurrency(r.montoImpuestos),
        montoBruto: this.formatCurrency(r.montoBruto),
      }),
    );

    const emisor = {
      nombre: rendicion.solicitud.usuarioEmisor?.nombreCompleto ?? 'N/A',
      cargo: rendicion.solicitud.usuarioEmisor?.cargo ?? 'N/A',
    };

    const directorProyecto = this.obtenerDirectorProyecto(
      rendicion.historialAprobaciones ?? [],
      Rol.CONTADOR,
      rendicion.aprobadorActual?.nombreCompleto,
      rendicion.aprobadorActual?.cargo,
    );

    const aprobadorFinal = {
      nombre: 'Marcos Fernando Terán Valenzuela',
      cargo: 'Director Ejecutivo',
    };

    return this.pdfService.generatePdf('rendicion.hbs', {
      ...rendicion,
      usuario: {
        nombre: emisor.nombre,
        cargo: emisor.cargo,
      },
      solicitud: {
        ...rendicion.solicitud,
        proyecto: rendicion.solicitud.proyecto || 'Proyecto General',
        montoTotalNeto: this.formatCurrency(montoRecibido),
      },
      aprobadorActualNombre:
        rendicion.aprobadorActual?.nombreCompleto ?? 'Sin asignar',
      fechaRendicion: this.formatDate(rendicion.fechaRendicion),
      montoRecibido: this.formatCurrency(montoRecibido),
      totalEfectivoPagado: this.formatCurrency(totalEfectivoPagado),
      totalImpuestosRetenidos: this.formatCurrency(totalImpuestosRetenidos),
      totalPresupuestado: this.formatCurrency(totalPresupuestado),
      saldoLiquido: Math.abs(finalSaldoLiquido),
      saldoLiquidoFormat: this.formatCurrency(Math.abs(finalSaldoLiquido)),
      saldoEsDevolucion: finalSaldoLiquido >= 0,
      // Liquidación de caja del ANEXO 4 (sobre el efectivo, no sobre el bruto)
      saldoEfectivo: this.formatCurrency(saldoEfectivo),
      aFavorEmpleado:
        saldoEfectivo < 0 ? this.formatCurrency(Math.abs(saldoEfectivo)) : null,
      aFavorProyecto:
        saldoEfectivo > 0 ? this.formatCurrency(saldoEfectivo) : null,
      conteoDocumentos: {
        facturasCantidad: conteo.facturasCantidad,
        facturasMonto: this.formatCurrency(conteo.facturasMonto),
        recibosCantidad: conteo.recibosCantidad,
        recibosMonto: this.formatCurrency(conteo.recibosMonto),
        totalCantidad: conteo.facturasCantidad + conteo.recibosCantidad,
        totalMonto: this.formatCurrency(
          conteo.facturasMonto + conteo.recibosMonto,
        ),
      },
      totalesTransacciones: {
        ingreso: this.formatCurrency(montoRecibido),
        egreso: this.formatCurrency(totalEfectivoPagado),
        saldo: this.formatCurrency(saldoEfectivo),
        total: this.formatCurrency(totalPresupuestado),
        rcIva: totalRcIva > 0 ? this.formatCurrency(totalRcIva) : '—',
        iue: totalIue > 0 ? this.formatCurrency(totalIue) : '—',
        it: totalIt > 0 ? this.formatCurrency(totalIt) : '—',
        totalImpuestos:
          totalImpuestosRetenidos > 0
            ? this.formatCurrency(totalImpuestosRetenidos)
            : '—',
        neto: this.formatCurrency(totalEfectivoPagado),
      },
      saldoStatus:
        finalSaldoLiquido >= 0
          ? 'A favor del Proyecto (a devolver)'
          : 'A favor del empleado (a reembolsar)',
      firmas: {
        emitidoPor: emisor,
        directorProyecto,
        aprobadoPor: aprobadorFinal,
      },
      transacciones,
      resumenContable,
      informeGastos: this.buildInformeTexto(rendicion.informeGastos),
      generatedAt: this.formatDate(new Date()),
    });
  }

  async create(dto: CreateRendicionDto, usuarioId: number) {
    const rendicion = await this.prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitud.findUnique({
        where: { id: dto.solicitudId },
        include: {
          rendicion: true,
        },
      });

      if (!solicitud || solicitud.deletedAt) {
        throw new NotFoundException('Solicitud no encontrada');
      }

      if (solicitud.usuarioEmisorId !== usuarioId) {
        throw new ForbiddenException(
          'Solo el emisor de la solicitud puede registrar esta rendición',
        );
      }

      if (solicitud.estado !== EstadoSolicitud.DESEMBOLSADO) {
        throw new BadRequestException(
          'Solo se puede rendir una solicitud en estado DESEMBOLSADO',
        );
      }

      if (solicitud.rendicion) {
        throw new BadRequestException(
          'La solicitud ya tiene una rendición registrada',
        );
      }

      const montosPorPartida = this.agruparMontosPorPartida(dto);
      const partidaIds = Array.from(montosPorPartida.keys());

      const partidas =
        partidaIds.length > 0
          ? await tx.solicitudPresupuesto.findMany({
              where: {
                id: { in: partidaIds },
                solicitudId: dto.solicitudId,
              },
              select: {
                id: true,
                poaId: true,
              },
            })
          : [];

      if (partidas.length !== partidaIds.length) {
        throw new BadRequestException(
          'Se detectaron partidas que no pertenecen a la solicitud rendida',
        );
      }

      const totalRespaldado = this.calcularTotalRespaldado(dto);
      const saldoLiquido = new Prisma.Decimal(solicitud.montoTotalNeto).minus(
        totalRespaldado,
      );

      if (dto.aprobadorActualId === usuarioId) {
        throw new BadRequestException(
          'No puedes asignarte a ti mismo como aprobador actual de la rendición',
        );
      }

      const aprobadorActual = await tx.usuario.findFirst({
        where: {
          id: dto.aprobadorActualId,
          deletedAt: null,
        },
      });

      if (!aprobadorActual) {
        throw new NotFoundException(
          `El usuario aprobador con ID ${dto.aprobadorActualId} no existe o está inactivo`,
        );
      }

      const rendicion = await tx.rendicion.create({
        data: {
          solicitudId: dto.solicitudId,
          fechaRendicion: dto.fechaRendicion,
          estado: EstadoRendicion.PENDIENTE,
          aprobadorActualId: dto.aprobadorActualId,
          observaciones: dto.observaciones,
          comprobanteUrl: dto.comprobanteUrl,
          montoRespaldado: totalRespaldado,
          saldoLiquido,
          gastosRendicion: {
            create: (dto.gastos ?? []).map((gasto) => ({
              tipoDocumento: this.toTipoDocumento(gasto.tipoDocumento),
              tipoRetencion: gasto.tipoRetencion,
              nroDocumento: gasto.numeroDocumento ?? 'S/N',
              fecha: gasto.fechaDocumento ?? dto.fechaRendicion,
              concepto: gasto.concepto,
              detalle: gasto.detalle ?? gasto.concepto,
              proveedor: gasto.proveedor,
              partidaId: gasto.partidaId,
              monto: new Prisma.Decimal(gasto.montoBruto),
              montoBruto: new Prisma.Decimal(gasto.montoBruto),
              montoImpuestos: new Prisma.Decimal(gasto.montoImpuestos),
              montoNeto: new Prisma.Decimal(gasto.montoNeto),
            })),
          },
          informeGastos: dto.informeGastos
            ? {
                create: {
                  fechaInicio: dto.informeGastos.fechaInicio,
                  fechaFin: dto.informeGastos.fechaFin,
                  actividades: {
                    create: dto.informeGastos.actividades.map((actividad) => ({
                      fecha: actividad.fecha,
                      lugar: actividad.lugar,
                      personaInstitucion: actividad.personaInstitucion,
                      actividadesRealizadas: actividad.actividadesRealizadas,
                    })),
                  },
                },
              }
            : undefined,
        },
        include: {
          gastosRendicion: true,
          informeGastos: {
            include: {
              actividades: true,
            },
          },
        },
      });

      await tx.historialAprobacion.create({
        data: {
          accion: TipoAccionHistorial.CREADO,
          comentario: 'Rendición creada y enviada a revisión',
          usuarioId,
          derivadoAId: dto.aprobadorActualId,
          solicitudId: dto.solicitudId,
          rendicionId: rendicion.id,
        },
      });

      return rendicion;
    });

    const aprobadorId = rendicion.aprobadorActualId;
    if (!aprobadorId) {
      this.logger.error(
        `[RendicionesService] No se pudo crear notificación para rendición ${rendicion.id}: aprobadorActualId no definido`,
      );
      return rendicion;
    }

    try {
      await this.notificacionesService.crearNotificacion({
        titulo: 'Nueva rendición asignada',
        mensaje: `Se ha asignado la rendición #${rendicion.id} para tu revisión`,
        tipo: 'RENDICION_PENDIENTE',
        usuarioId: aprobadorId,
        solicitudId: rendicion.solicitudId,
        urlDestino: `/app/rendiciones/${rendicion.id}`,
      });
    } catch (error: unknown) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `[RendicionesService] Error al crear notificación para rendición ${rendicion.id}: ${normalizedError.message}`,
        normalizedError.stack,
      );
    }

    return rendicion;
  }

  /**
   * Actualiza una rendición observada.
   * Solo el creador de la solicitud puede editar, y solo si el estado es OBSERVADO.
   * Requiere seleccionar un nuevo aprobador y reenvía la rendición a revisión.
   */
  async update(id: number, dto: UpdateRendicionDto, usuarioId: number) {
    // Guardar datos para notificación fuera de la transacción
    let nuevoAprobadorId: number;
    let solicitudId: number;
    let codigoSolicitud = '';

    const rendicionActualizada = await this.prisma.$transaction(async (tx) => {
      // 1. Verificar que existe la rendición
      const rendicion = await tx.rendicion.findUnique({
        where: { id },
        include: {
          solicitud: {
            select: {
              id: true,
              usuarioEmisorId: true,
              codigoSolicitud: true,
            },
          },
          gastosRendicion: true,
          informeGastos: {
            include: {
              actividades: true,
            },
          },
        },
      });

      if (!rendicion) {
        throw new NotFoundException('Rendición no encontrada');
      }

      // 2. Verificar que el usuario es el creador de la solicitud
      if (rendicion.solicitud.usuarioEmisorId !== usuarioId) {
        throw new ForbiddenException(
          'Solo el creador de la solicitud puede editar esta rendición',
        );
      }

      // 3. Verificar que el estado es OBSERVADO
      if (rendicion.estado !== EstadoRendicion.OBSERVADO) {
        throw new BadRequestException(
          'Solo se pueden editar rendiciones en estado OBSERVADO',
        );
      }

      // 4. Verificar que el nuevo aprobador no sea el mismo usuario
      if (dto.aprobadorActualId === usuarioId) {
        throw new BadRequestException(
          'No puedes asignarte a ti mismo como aprobador de la rendición',
        );
      }

      // 5. Verificar que el nuevo aprobador existe y está activo
      const nuevoAprobador = await tx.usuario.findFirst({
        where: {
          id: dto.aprobadorActualId,
          deletedAt: null,
        },
      });

      if (!nuevoAprobador) {
        throw new NotFoundException(
          `El usuario aprobador con ID ${dto.aprobadorActualId} no existe o está inactivo`,
        );
      }

      // 6. Validar partidas si se enviaron gastos
      if (dto.gastos && dto.gastos.length > 0) {
        const montosPorPartida = this.agruparMontosPorPartida({
          ...dto,
          solicitudId: rendicion.solicitudId,
          fechaRendicion: dto.fechaRendicion ?? rendicion.fechaRendicion,
          gastos: dto.gastos,
        } as CreateRendicionDto);
        const partidaIds = Array.from(montosPorPartida.keys());

        const partidas =
          partidaIds.length > 0
            ? await tx.solicitudPresupuesto.findMany({
                where: {
                  id: { in: partidaIds },
                  solicitudId: rendicion.solicitudId,
                },
                select: {
                  id: true,
                  poaId: true,
                },
              })
            : [];

        if (partidas.length !== partidaIds.length) {
          throw new BadRequestException(
            'Se detectaron partidas que no pertenecen a la solicitud rendida',
          );
        }
      }

      // 7. Eliminar gastos e informe anteriores
      await tx.gastoRendicion.deleteMany({
        where: { rendicionId: id },
      });

      if (rendicion.informeGastos) {
        await tx.actividadInforme.deleteMany({
          where: { informeId: rendicion.informeGastos.id },
        });
        await tx.informeGastos.delete({
          where: { id: rendicion.informeGastos.id },
        });
      }

      // 8. Calcular nuevos totales
      const fechaRendicion = dto.fechaRendicion ?? rendicion.fechaRendicion;
      const gastos = dto.gastos ?? [];

      const totalRespaldado = this.calcularTotalRespaldado({
        solicitudId: rendicion.solicitudId,
        fechaRendicion,
        aprobadorActualId: dto.aprobadorActualId,
        gastos,
      } as CreateRendicionDto);

      const solicitud = await tx.solicitud.findUnique({
        where: { id: rendicion.solicitudId },
        select: { montoTotalNeto: true },
      });

      const saldoLiquido = new Prisma.Decimal(
        solicitud?.montoTotalNeto ?? 0,
      ).minus(totalRespaldado);

      // 9. Actualizar rendición con nuevos datos
      const updated = await tx.rendicion.update({
        where: { id },
        data: {
          fechaRendicion,
          estado: EstadoRendicion.PENDIENTE,
          aprobadorActualId: dto.aprobadorActualId,
          observaciones: dto.observaciones,
          // Sólo se pisa si viene en el payload de corrección
          ...(dto.comprobanteUrl !== undefined
            ? { comprobanteUrl: dto.comprobanteUrl }
            : {}),
          montoRespaldado: totalRespaldado,
          saldoLiquido,
          gastosRendicion: {
            create: gastos.map((gasto) => ({
              tipoDocumento: this.toTipoDocumento(gasto.tipoDocumento),
              tipoRetencion: gasto.tipoRetencion,
              nroDocumento: gasto.numeroDocumento ?? 'S/N',
              fecha: gasto.fechaDocumento ?? fechaRendicion,
              concepto: gasto.concepto,
              detalle: gasto.detalle ?? gasto.concepto,
              proveedor: gasto.proveedor,
              partidaId: gasto.partidaId,
              monto: new Prisma.Decimal(gasto.montoBruto),
              montoBruto: new Prisma.Decimal(gasto.montoBruto),
              montoImpuestos: new Prisma.Decimal(gasto.montoImpuestos),
              montoNeto: new Prisma.Decimal(gasto.montoNeto),
            })),
          },
          informeGastos: dto.informeGastos
            ? {
                create: {
                  fechaInicio: dto.informeGastos.fechaInicio,
                  fechaFin: dto.informeGastos.fechaFin,
                  actividades: {
                    create: dto.informeGastos.actividades.map((actividad) => ({
                      fecha: actividad.fecha,
                      lugar: actividad.lugar,
                      personaInstitucion: actividad.personaInstitucion,
                      actividadesRealizadas: actividad.actividadesRealizadas,
                    })),
                  },
                },
              }
            : undefined,
        },
        include: RENDICION_INCLUDE,
      });

      // 10. Registrar en historial
      await tx.historialAprobacion.create({
        data: {
          accion: TipoAccionHistorial.DERIVADO,
          comentario: 'Rendición corregida y reenviada a revisión',
          usuarioId,
          derivadoAId: dto.aprobadorActualId,
          solicitudId: rendicion.solicitudId,
          rendicionId: id,
        },
      });

      // Guardar datos para notificación
      nuevoAprobadorId = dto.aprobadorActualId;
      solicitudId = rendicion.solicitudId;
      codigoSolicitud = rendicion.solicitud.codigoSolicitud ?? '';

      return updated;
    });

    // 11. Crear notificación para el nuevo aprobador (fuera de transacción)
    try {
      await this.notificacionesService.crearNotificacion({
        titulo: 'Rendición corregida asignada',
        mensaje: `Se ha asignado la rendición de la solicitud ${codigoSolicitud} (corregida) para tu revisión`,
        tipo: 'RENDICION_PENDIENTE',
        usuarioId: nuevoAprobadorId!,
        solicitudId: solicitudId!,
        urlDestino: `/app/rendiciones/${id}`,
      });
    } catch (error: unknown) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `[RendicionesService] Error al crear notificación (update) para rendición ${id}: ${normalizedError.message}`,
        normalizedError.stack,
      );
    }

    return rendicionActualizada;
  }

  async aprobar(
    id: number,
    dto: AprobarRendicionDto,
    usuarioId: number,
    rolUsuario: Rol,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const rendicion = await tx.rendicion.findUnique({
        where: { id },
        include: {
          solicitud: {
            include: {
              rendicion: true,
            },
          },
          gastosRendicion: {
            select: {
              partidaId: true,
              montoBruto: true,
            },
          },
        },
      });

      if (!rendicion) {
        throw new NotFoundException('Rendición no encontrada');
      }

      const puedeActuar =
        rolUsuario === Rol.ADMIN ||
        rolUsuario === Rol.EJECUTIVO ||
        rolUsuario === Rol.CONTADOR ||
        rolUsuario === Rol.TESORERO ||
        rendicion.aprobadorActualId === usuarioId;

      if (!puedeActuar) {
        throw new ForbiddenException(
          'No tienes permiso para aprobar esta rendición',
        );
      }

      if (rendicion.estado === EstadoRendicion.APROBADO) {
        throw new BadRequestException('La rendición ya fue aprobada');
      }

      if (rolUsuario === Rol.CONTADOR) {
        const montoPorPartida = this.agruparMontosPorPartidaDesdeRendicion(
          rendicion.gastosRendicion,
        );
        const partidaIds = Array.from(montoPorPartida.keys());

        const partidas =
          partidaIds.length > 0
            ? await tx.solicitudPresupuesto.findMany({
                where: {
                  id: { in: partidaIds },
                  solicitudId: rendicion.solicitudId,
                },
                select: {
                  id: true,
                  poaId: true,
                },
              })
            : [];

        if (partidas.length !== partidaIds.length) {
          throw new BadRequestException(
            'Se detectaron partidas inválidas para ejecutar POA en esta rendición',
          );
        }

        const montosPorPoa = this.agruparMontosPorPoa(
          partidas,
          montoPorPartida,
        );

        // Validar que la ejecución no supere el techo presupuestario
        // (costoTotal) de cada POA ANTES de aplicar cualquier incremento.
        // Sin esta guarda el montoEjecutado podía exceder el costoTotal y dejar
        // el saldo disponible negativo de forma permanente, ya que no existe una
        // ruta de reversión para una rendición aprobada.
        const poaIds = Array.from(montosPorPoa.keys());
        const poasAfectados = await tx.poa.findMany({
          where: { id: { in: poaIds } },
          select: {
            id: true,
            codigoPoa: true,
            costoTotal: true,
            montoEjecutado: true,
          },
        });
        const poaPorId = new Map(poasAfectados.map((poa) => [poa.id, poa]));

        for (const [poaId, montoEjecutar] of montosPorPoa) {
          const poa = poaPorId.get(poaId);

          if (!poa) {
            throw new NotFoundException(
              `No se encontró el POA ${poaId} para ejecutar la rendición`,
            );
          }

          const nuevoEjecutado = poa.montoEjecutado.plus(montoEjecutar);

          if (nuevoEjecutado.greaterThan(poa.costoTotal)) {
            const disponible = poa.costoTotal.minus(poa.montoEjecutado);
            throw new BadRequestException(
              `La aprobación excede el presupuesto del POA ${poa.codigoPoa}: ` +
                `se intenta ejecutar ${this.formatCurrency(montoEjecutar.toNumber())} ` +
                `pero solo restan ${this.formatCurrency(disponible.toNumber())} ` +
                `del costo total (${this.formatCurrency(poa.costoTotal.toNumber())}).`,
            );
          }
        }

        // Todas las validaciones pasaron: aplicar los incrementos.
        for (const [poaId, montoEjecutar] of montosPorPoa) {
          await tx.poa.update({
            where: { id: poaId },
            data: {
              montoEjecutado: {
                increment: montoEjecutar,
              },
            },
          });
        }

        const rendicionAprobada = await tx.rendicion.update({
          where: { id },
          data: {
            estado: EstadoRendicion.APROBADO,
            aprobadorActualId: null,
            observaciones: dto.comentario ?? rendicion.observaciones,
          },
        });

        await tx.solicitud.update({
          where: { id: rendicion.solicitudId },
          data: {
            estado: EstadoSolicitud.EJECUTADO,
            observacion: dto.comentario ?? rendicion.solicitud.observacion,
          },
        });

        await tx.historialAprobacion.create({
          data: {
            accion: TipoAccionHistorial.APROBADO,
            comentario: dto.comentario,
            usuarioId,
            solicitudId: rendicion.solicitudId,
            rendicionId: rendicion.id,
          },
        });

        return rendicionAprobada;
      }

      if (!dto.derivadoAId) {
        throw new BadRequestException(
          'Solo un CONTADOR puede cerrar la rendición. Debes derivarla al siguiente aprobador o contador',
        );
      }

      if (dto.derivadoAId === usuarioId) {
        throw new BadRequestException(
          'No puedes derivar la rendición al mismo usuario actor',
        );
      }

      const destinatario = await tx.usuario.findFirst({
        where: {
          id: dto.derivadoAId,
          deletedAt: null,
        },
      });

      if (!destinatario) {
        throw new NotFoundException(
          `El usuario derivado con ID ${dto.derivadoAId} no existe o está inactivo`,
        );
      }

      const rendicionDerivada = await tx.rendicion.update({
        where: { id },
        data: {
          estado: EstadoRendicion.PENDIENTE,
          aprobadorActualId: dto.derivadoAId,
          observaciones: dto.comentario ?? rendicion.observaciones,
        },
      });

      await tx.historialAprobacion.create({
        data: {
          accion: TipoAccionHistorial.DERIVADO,
          comentario: dto.comentario,
          usuarioId,
          derivadoAId: dto.derivadoAId,
          solicitudId: rendicion.solicitudId,
          rendicionId: rendicion.id,
        },
      });

      return rendicionDerivada;
    });

    if (dto.derivadoAId) {
      try {
        const emisor = await this.prisma.usuario.findUnique({
          where: { id: usuarioId },
          select: { nombreCompleto: true },
        });

        const rendicion = await this.prisma.rendicion.findUnique({
          where: { id },
          include: { solicitud: true },
        });

        await this.notificacionesService.crearNotificacion({
          titulo: 'Rendición derivada',
          mensaje: `Tienes una rendición pendiente de revisión para la solicitud ${rendicion?.solicitud?.codigoSolicitud ?? ''} derivada por ${emisor?.nombreCompleto || 'un usuario'}.`,
          tipo: 'RENDICION_PENDIENTE',
          usuarioId: dto.derivadoAId,
          solicitudId: rendicion?.solicitudId,
          urlDestino: `/app/aprobaciones`,
        });
      } catch (error) {
        const normalizedError =
          error instanceof Error ? error : new Error(String(error));
        this.logger.error(
          `[RendicionesService] Error al crear notificación (derivar) para rendición ${id}: ${normalizedError.message}`,
          normalizedError.stack,
        );
      }
    }

    return result;
  }

  async observar(
    id: number,
    dto: ObservarRendicionDto,
    usuarioId: number,
    rolUsuario: Rol,
  ) {
    // Guardar el creadorId para usarlo fuera de la transacción
    let creadorId: number;

    const rendicionObservada = await this.prisma.$transaction(async (tx) => {
      const rendicion = await tx.rendicion.findUnique({
        where: { id },
        include: {
          solicitud: {
            select: {
              id: true,
              usuarioEmisorId: true,
              codigoSolicitud: true,
            },
          },
        },
      });

      if (!rendicion) {
        throw new NotFoundException('Rendición no encontrada');
      }

      const puedeActuar =
        rolUsuario === Rol.ADMIN ||
        rolUsuario === Rol.EJECUTIVO ||
        rolUsuario === Rol.CONTADOR ||
        rolUsuario === Rol.TESORERO ||
        rendicion.aprobadorActualId === usuarioId;

      if (!puedeActuar) {
        throw new ForbiddenException(
          'No tienes permiso para observar esta rendición',
        );
      }

      creadorId = rendicion.solicitud.usuarioEmisorId;

      const updated = await tx.rendicion.update({
        where: { id },
        data: {
          estado: EstadoRendicion.OBSERVADO,
          aprobadorActualId: creadorId,
          observaciones: dto.comentario,
        },
      });

      await tx.historialAprobacion.create({
        data: {
          accion: TipoAccionHistorial.OBSERVADO,
          comentario: dto.comentario,
          usuarioId,
          derivadoAId: creadorId,
          solicitudId: rendicion.solicitudId,
          rendicionId: rendicion.id,
        },
      });

      return { updated, codigoSolicitud: rendicion.solicitud.codigoSolicitud };
    });

    // Crear notificación para el creador (fuera de la transacción para no afectar el flujo principal)
    try {
      await this.notificacionesService.crearNotificacion({
        titulo: 'Rendición observada',
        mensaje: `Tu rendición de la solicitud ${rendicionObservada.codigoSolicitud} requiere correcciones. Observación: ${dto.comentario}`,
        tipo: 'RENDICION_OBSERVADA',
        usuarioId: creadorId!,
        solicitudId: rendicionObservada.updated.solicitudId,
        urlDestino: `/app/rendiciones/${id}/editar`,
      });
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        `[RendicionesService] Error al crear notificación (observar) para rendición ${id}: ${normalizedError.message}`,
        normalizedError.stack,
      );
    }

    return rendicionObservada.updated;
  }

  async updatePartidaContable(
    gastoId: number,
    dto: UpdateGastoPartidaContableDto,
    usuarioId: number,
  ) {
    const gasto = await this.prisma.gastoRendicion.findUnique({
      where: { id: gastoId },
      include: {
        rendicion: {
          select: {
            id: true,
            aprobadorActualId: true,
            solicitud: { select: { usuarioEmisorId: true } },
          },
        },
      },
    });

    if (!gasto) {
      throw new NotFoundException('Gasto de rendición no encontrado');
    }

    if (gasto.rendicion.aprobadorActualId !== usuarioId) {
      throw new ForbiddenException(
        'No tienes permiso para modificar este gasto',
      );
    }

    if (dto.codigo) {
      let partida = await this.prisma.partidaContable.findUnique({
        where: { codigo: dto.codigo },
        select: { id: true, codigo: true, nombre: true },
      });

      if (!partida) {
        const candidates = await this.prisma.partidaContable.findMany({
          where: { codigo: { startsWith: dto.codigo } },
          select: { id: true, codigo: true, nombre: true },
          take: 2,
        });

        if (candidates.length === 1) {
          partida = candidates[0];
        } else if (candidates.length === 0) {
          throw new NotFoundException(
            `No se encontró ninguna partida contable con el código "${dto.codigo}"`,
          );
        } else {
          throw new BadRequestException(
            `El código "${dto.codigo}" es ambiguo: coincide con múltiples partidas. Especifique el código completo`,
          );
        }
      }

      await this.prisma.gastoRendicion.update({
        where: { id: gastoId },
        data: { partidaContableId: partida.id },
      });
    } else {
      await this.prisma.gastoRendicion.update({
        where: { id: gastoId },
        data: { partidaContableId: null },
      });
    }

    return this.prisma.gastoRendicion.findUnique({
      where: { id: gastoId },
      include: { partidaContable: true },
    });
  }

  async updatePartidaPresupuestaria(
    gastoId: number,
    dto: UpdateGastoPartidaPresupuestariaDto,
    usuarioId: number,
  ) {
    const gasto = await this.prisma.gastoRendicion.findUnique({
      where: { id: gastoId },
      include: {
        rendicion: {
          select: {
            id: true,
            aprobadorActualId: true,
            solicitud: { select: { usuarioEmisorId: true } },
          },
        },
      },
    });

    if (!gasto) {
      throw new NotFoundException('Gasto de rendición no encontrado');
    }

    if (gasto.rendicion.aprobadorActualId !== usuarioId) {
      throw new ForbiddenException(
        'No tienes permiso para modificar este gasto',
      );
    }

    if (dto.partidaId) {
      const partida = await this.prisma.solicitudPresupuesto.findUnique({
        where: { id: dto.partidaId },
      });

      if (!partida) {
        throw new NotFoundException('Partida presupuestaria no encontrada');
      }

      await this.prisma.gastoRendicion.update({
        where: { id: gastoId },
        data: { partidaId: partida.id },
      });
    } else {
      await this.prisma.gastoRendicion.update({
        where: { id: gastoId },
        data: { partidaId: null },
      });
    }

    return this.prisma.gastoRendicion.findUnique({
      where: { id: gastoId },
      include: {
        partida: {
          include: {
            poa: {
              include: {
                estructura: {
                  include: { partida: true, proyecto: true, grupo: true },
                },
              },
            },
          },
        },
      },
    });
  }

  private toTipoDocumento(tipoDocumento: string): TipoDocumento {
    const doc = TipoDocumento[tipoDocumento as keyof typeof TipoDocumento];
    if (doc) return doc;
    return TipoDocumento.RECIBO;
  }

  private calcularTotalRespaldado(dto: CreateRendicionDto): Prisma.Decimal {
    const totalGastos = (dto.gastos ?? []).reduce(
      (acc, gasto) =>
        acc.plus(new Prisma.Decimal(gasto.montoBruto ?? gasto.montoTotal ?? 0)),
      new Prisma.Decimal(0),
    );

    return totalGastos;
  }

  private agruparMontosPorPartida(
    dto: CreateRendicionDto,
  ): Map<number, Prisma.Decimal> {
    const montosPorPartida = new Map<number, Prisma.Decimal>();

    for (const gasto of dto.gastos ?? []) {
      const montoBruto = new Prisma.Decimal(gasto.montoBruto);
      const acumulado =
        montosPorPartida.get(gasto.partidaId) ?? new Prisma.Decimal(0);
      montosPorPartida.set(gasto.partidaId, acumulado.plus(montoBruto));
    }

    return montosPorPartida;
  }

  private agruparMontosPorPartidaDesdeRendicion(
    gastos: {
      partidaId: number | null;
      montoBruto: Prisma.Decimal;
    }[],
  ): Map<number, Prisma.Decimal> {
    const montosPorPartida = new Map<number, Prisma.Decimal>();

    for (const gasto of gastos) {
      if (!gasto.partidaId) continue;

      const acumulado =
        montosPorPartida.get(gasto.partidaId) ?? new Prisma.Decimal(0);
      montosPorPartida.set(gasto.partidaId, acumulado.plus(gasto.montoBruto));
    }

    return montosPorPartida;
  }

  private agruparMontosPorPoa(
    partidas: {
      id: number;
      poaId: number;
    }[],
    montosPorPartida: Map<number, Prisma.Decimal>,
  ): Map<number, Prisma.Decimal> {
    const montosPorPoa = new Map<number, Prisma.Decimal>();

    for (const partida of partidas) {
      const montoPartida =
        montosPorPartida.get(partida.id) ?? new Prisma.Decimal(0);
      const acumuladoPoa =
        montosPorPoa.get(partida.poaId) ?? new Prisma.Decimal(0);
      montosPorPoa.set(partida.poaId, acumuladoPoa.plus(montoPartida));
    }

    return montosPorPoa;
  }

  private formatCurrency(value: number): string {
    return `Bs ${new Intl.NumberFormat('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)}`;
  }

  private obtenerDirectorProyecto(
    historial: {
      usuario: {
        nombreCompleto: string | null;
        cargo: string | null;
        rol: Rol;
      } | null;
      derivadoA: { rol: Rol | null } | null;
    }[],
    rolObjetivo: Rol,
    fallbackNombre?: string | null,
    fallbackCargo?: string | null,
  ): { nombre: string; cargo: string } {
    const idx = historial.findIndex(
      (h) => h.derivadoA?.rol === rolObjetivo || h.usuario?.rol === rolObjetivo,
    );

    const candidato = idx > 0 ? historial[idx - 1]?.usuario : null;

    const nombre = candidato?.nombreCompleto ?? fallbackNombre ?? 'Sin asignar';
    const cargo = candidato?.cargo ?? fallbackCargo ?? 'Sin cargo asignado';

    return { nombre, cargo };
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

  private buildInformeTexto(
    informe:
      | {
          fechaInicio: Date;
          fechaFin: Date;
          actividades?: {
            fecha: Date;
            lugar: string;
            personaInstitucion: string;
            actividadesRealizadas: string;
          }[];
        }
      | null
      | undefined,
  ): string {
    if (!informe) {
      return 'Sin informe registrado.';
    }

    const encabezado = `Periodo: ${this.formatDate(informe.fechaInicio)} - ${this.formatDate(informe.fechaFin)}`;
    const actividades = (informe.actividades ?? []).map(
      (actividad, index) =>
        `Actividad ${index + 1}:\nFecha: ${this.formatDate(actividad.fecha)}\nLugar: ${actividad.lugar}\nPersona / Institución: ${actividad.personaInstitucion}\nDetalle: ${actividad.actividadesRealizadas}`,
    );

    return [encabezado, ...actividades].join('\n\n');
  }

  async updateGastoPartidaContable(
    gastoId: number,
    partidaContableId: number | null,
  ) {
    const gasto = await this.prisma.gastoRendicion.findUnique({
      where: { id: gastoId },
    });

    if (!gasto) {
      throw new NotFoundException('Gasto no encontrado');
    }

    if (partidaContableId !== null) {
      const pc = await this.prisma.partidaContable.findUnique({
        where: { id: partidaContableId },
      });
      if (!pc) {
        throw new NotFoundException('Partida contable no encontrada');
      }
    }

    return this.prisma.gastoRendicion.update({
      where: { id: gastoId },
      data: {
        partidaContableId,
      },
      include: {
        partidaContable: true,
      },
    });
  }
}
