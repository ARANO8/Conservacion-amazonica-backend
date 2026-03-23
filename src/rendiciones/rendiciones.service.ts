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
import { AprobarRendicionDto } from './dto/aprobar-rendicion.dto';
import { ObservarRendicionDto } from './dto/observar-rendicion.dto';
import { PdfService } from '../pdf/pdf.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

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
      partida: {
        include: {
          poa: {
            include: {
              estructura: {
                include: {
                  partida: true,
                },
              },
            },
          },
        },
      },
    },
  },
  declaracionesJuradas: true,
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
} satisfies Prisma.RendicionInclude;

@Injectable()
export class RendicionesService {
  private readonly logger = new Logger(RendicionesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async findAll(usuario: { id: number; rol: Rol }, solicitudId?: number) {
    const where: Prisma.RendicionWhereInput = {};

    if (usuario.rol === Rol.USUARIO) {
      where.solicitud = {
        usuarioEmisorId: usuario.id,
        deletedAt: null,
      };
    } else {
      where.solicitud = {
        deletedAt: null,
      };
    }

    if (solicitudId !== undefined) {
      where.solicitudId = solicitudId;
    }

    return this.prisma.rendicion.findMany({
      where,
      include: RENDICION_INCLUDE,
      orderBy: { fechaRendicion: 'desc' },
    });
  }

  async findOne(id: number) {
    const rendicion = await this.prisma.rendicion.findUnique({
      where: { id },
      include: RENDICION_INCLUDE,
    });

    if (!rendicion) {
      throw new NotFoundException('Rendición no encontrada');
    }

    return rendicion;
  }

  async findBySolicitudId(solicitudId: number) {
    const rendicion = await this.prisma.rendicion.findUnique({
      where: { solicitudId },
      include: RENDICION_INCLUDE,
    });

    if (!rendicion) {
      throw new NotFoundException(
        'No se encontró una rendición para la solicitud indicada',
      );
    }

    return rendicion;
  }

  async generatePdf(id: number): Promise<Buffer> {
    const rendicion = await this.findOne(id);

    const totalEfectivoPagado = Number(
      (rendicion.gastosRendicion ?? [])
        .reduce((acc, gasto) => acc + Number(gasto.montoNeto ?? 0), 0)
        .toFixed(2),
    );

    const montoRecibido = Number(rendicion.solicitud.montoTotalNeto ?? 0);
    const saldoLiquido = Number(
      (montoRecibido - totalEfectivoPagado).toFixed(2),
    );

    return this.pdfService.generatePdf('rendicion.hbs', {
      ...rendicion,
      usuario: {
        nombre: rendicion.solicitud.usuarioEmisor?.nombreCompleto ?? 'N/A',
        cargo: rendicion.solicitud.usuarioEmisor?.cargo ?? 'N/A',
      },
      solicitud: {
        ...rendicion.solicitud,
        montoTotalNeto: this.formatCurrency(montoRecibido),
      },
      aprobadorActualNombre:
        rendicion.aprobadorActual?.nombreCompleto ?? 'Sin asignar',
      fechaRendicion: this.formatDate(rendicion.fechaRendicion),
      totalEfectivoPagado,
      saldoLiquido,
      totalEfectivoPagadoFormat: this.formatCurrency(totalEfectivoPagado),
      saldoLiquidoFormat: this.formatCurrency(saldoLiquido),
      gastos: (rendicion.gastosRendicion ?? []).map((gasto) => ({
        ...gasto,
        fecha: this.formatDate(gasto.fecha),
        proveedor: gasto.proveedor ?? 'N/A',
        concepto: gasto.concepto ?? gasto.detalle ?? 'N/A',
        montoBruto: this.formatCurrency(Number(gasto.montoBruto ?? 0)),
        montoImpuestos: this.formatCurrency(Number(gasto.montoImpuestos ?? 0)),
        montoNeto: this.formatCurrency(Number(gasto.montoNeto ?? 0)),
      })),
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
          observaciones:
            dto.observaciones ?? dto.declaracionJurada?.observaciones,
          montoRespaldado: totalRespaldado,
          saldoLiquido,
          gastosRendicion: {
            create: (dto.gastos ?? []).map((gasto) => ({
              tipoDocumento: this.toTipoDocumento(gasto.tipoDocumento),
              nroDocumento: gasto.numeroDocumento ?? 'S/N',
              fecha: gasto.fechaDocumento ?? dto.fechaRendicion,
              concepto: gasto.concepto,
              detalle: gasto.detalle ?? gasto.concepto,
              proveedor: gasto.proveedor,
              partidaId: gasto.partidaId,
              urlComprobante: gasto.urlComprobante,
              monto: new Prisma.Decimal(gasto.montoBruto),
              montoBruto: new Prisma.Decimal(gasto.montoBruto),
              montoImpuestos: new Prisma.Decimal(gasto.montoImpuestos),
              montoNeto: new Prisma.Decimal(gasto.montoNeto),
            })),
          },
          declaracionesJuradas: {
            create: (dto.gastosSinRespaldo ?? []).map((declaracion) => ({
              fecha: declaracion.fechaGasto ?? dto.fechaRendicion,
              detalle: declaracion.detalle,
              monto: new Prisma.Decimal(declaracion.monto),
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
          declaracionesJuradas: true,
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
        urlDestino: '/app/aprobaciones',
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

  async aprobar(
    id: number,
    dto: AprobarRendicionDto,
    usuarioId: number,
    rolUsuario: Rol,
  ) {
    return this.prisma.$transaction(async (tx) => {
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

      if (
        rendicion.estado === EstadoRendicion.APROBADO ||
        rendicion.estado === EstadoRendicion.APROBADA
      ) {
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
  }

  async observar(
    id: number,
    dto: ObservarRendicionDto,
    usuarioId: number,
    rolUsuario: Rol,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const rendicion = await tx.rendicion.findUnique({
        where: { id },
        include: {
          solicitud: {
            select: {
              id: true,
              usuarioEmisorId: true,
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

      const creadorId = rendicion.solicitud.usuarioEmisorId;

      const rendicionObservada = await tx.rendicion.update({
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

      return rendicionObservada;
    });
  }

  private toTipoDocumento(tipoDocumento: string): TipoDocumento {
    if (tipoDocumento === TipoDocumento.FACTURA) return TipoDocumento.FACTURA;
    return TipoDocumento.RECIBO;
  }

  private calcularTotalRespaldado(dto: CreateRendicionDto): Prisma.Decimal {
    const totalGastos = (dto.gastos ?? []).reduce(
      (acc, gasto) =>
        acc.plus(new Prisma.Decimal(gasto.montoBruto ?? gasto.montoTotal ?? 0)),
      new Prisma.Decimal(0),
    );

    const totalSinRespaldo = (dto.gastosSinRespaldo ?? []).reduce(
      (acc, declaracion) => acc.plus(new Prisma.Decimal(declaracion.monto)),
      new Prisma.Decimal(0),
    );

    return totalGastos.plus(totalSinRespaldo);
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
}
