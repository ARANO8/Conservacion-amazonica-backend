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

    const totalEfectivoPagado = Number(
      (rendicion.gastosRendicion ?? [])
        .reduce((acc, gasto) => acc + Number(gasto.montoNeto ?? 0), 0)
        .toFixed(2),
    );

    const montoRecibido = Number(rendicion.solicitud.montoTotalNeto ?? 0);
    const saldoLiquido = Number(
      (montoRecibido - totalEfectivoPagado).toFixed(2),
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
      firmas: {
        emitidoPor: emisor,
        directorProyecto,
        aprobadoPor: aprobadorFinal,
      },
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
          observaciones: dto.observaciones,
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
          montoRespaldado: totalRespaldado,
          saldoLiquido,
          gastosRendicion: {
            create: gastos.map((gasto) => ({
              tipoDocumento: this.toTipoDocumento(gasto.tipoDocumento),
              nroDocumento: gasto.numeroDocumento ?? 'S/N',
              fecha: gasto.fechaDocumento ?? fechaRendicion,
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

    if (rolUsuario !== Rol.CONTADOR && dto.derivadoAId) {
      try {
        await this.notificacionesService.crearNotificacion({
          titulo: 'Rendición derivada para revisión',
          mensaje: `Se ha derivado la rendición #${id} para su revisión y aprobación`,
          tipo: 'RENDICION_PENDIENTE',
          usuarioId: dto.derivadoAId,
          solicitudId: result.solicitudId,
          urlDestino: `/app/rendiciones/${id}`,
        });
      } catch (error: unknown) {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(String(error));
        this.logger.error(
          `[RendicionesService] Error al crear notificación de derivación para rendición ${id}: ${normalizedError.message}`,
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
        throw new NotFoundException(
          'Partida presupuestaria no encontrada',
        );
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
      include: { partida: { include: { poa: { include: { estructura: { include: { partida: true, proyecto: true, grupo: true } } } } } } },
    });
  }

  private toTipoDocumento(tipoDocumento: string): TipoDocumento {
    const validValues = Object.values(TipoDocumento) as string[];
    if (validValues.includes(tipoDocumento)) {
      return tipoDocumento as TipoDocumento;
    }
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
}
