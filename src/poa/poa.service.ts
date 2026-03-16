import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoPoa, Prisma } from '@prisma/client';
import { CreatePoaDto } from './dto/create-poa.dto';
import { UpdatePoaDto } from './dto/update-poa.dto';
import { PoaPaginationDto } from './dto/poa-pagination.dto';
import { PoaLookupDto } from './dto/poa-lookup.dto';

type PoaDetailed = Prisma.PoaGetPayload<{
  include: {
    estructura: {
      include: {
        proyecto: {
          include: {
            cuentaBancaria: true;
          };
        };
        grupo: true;
        partida: true;
      };
    };
    actividad: true;
    codigoPresupuestario: true;
  };
}>;

type PoaWithSaldo<T> = T & {
  saldoDisponible: number;
  montoComprometido: number;
  tieneCompromisos: boolean;
};

@Injectable()
export class PoaService {
  constructor(private prisma: PrismaService) {}

  async addSaldoDisponible<
    T extends { id: number; costoTotal: Prisma.Decimal },
  >(poa: T): Promise<PoaWithSaldo<T>> {
    const comprometidoRaw = await this.prisma.solicitudPresupuesto.aggregate({
      where: {
        poaId: poa.id,
        solicitud: {
          deletedAt: null,
        },
      },
      _sum: {
        subtotalPresupuestado: true,
      },
    });

    const montoComprometido =
      comprometidoRaw._sum.subtotalPresupuestado || new Prisma.Decimal(0);

    const saldoDisponible = poa.costoTotal.sub(montoComprometido).toNumber();

    return {
      ...poa,
      montoComprometido: montoComprometido.toNumber(),
      saldoDisponible,
      tieneCompromisos: montoComprometido.gt(0),
    };
  }

  /**
   * Versión batch de addSaldoDisponible.
   * Lanza UNA sola consulta groupBy para todos los poaIds recibidos en lugar de
   * N consultas individuales, eliminando el problema N+1.
   */
  private async batchEnrichWithSaldos<
    T extends { id: number; costoTotal: Prisma.Decimal },
  >(poas: T[]): Promise<PoaWithSaldo<T>[]> {
    if (poas.length === 0) return [];

    const poaIds = poas.map((p) => p.id);

    const sums = await this.prisma.solicitudPresupuesto.groupBy({
      by: ['poaId'],
      where: {
        poaId: { in: poaIds },
        solicitud: { deletedAt: null },
      },
      _sum: { subtotalPresupuestado: true },
    });

    const sumMap = new Map<number, Prisma.Decimal>(
      sums.map((s) => [
        s.poaId,
        s._sum.subtotalPresupuestado ?? new Prisma.Decimal(0),
      ]),
    );

    return poas.map((poa) => {
      const montoComprometido = sumMap.get(poa.id) ?? new Prisma.Decimal(0);
      const saldoDisponible = poa.costoTotal.sub(montoComprometido).toNumber();
      return {
        ...poa,
        montoComprometido: montoComprometido.toNumber(),
        saldoDisponible,
        tieneCompromisos: montoComprometido.gt(0),
      };
    });
  }

  async findAll(paginationDto: PoaPaginationDto) {
    const { page = 1, limit = 10, search } = paginationDto;
    const skip = (page - 1) * limit;

    const where: Prisma.PoaWhereInput = {
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { codigoPoa: { contains: search, mode: 'insensitive' } },
        {
          estructura: {
            proyecto: { nombre: { contains: search, mode: 'insensitive' } },
          },
        },
        {
          actividad: {
            detalleDescripcion: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.poa.count({ where }),
      this.prisma.poa.findMany({
        where,
        skip,
        take: limit,
        include: {
          estructura: {
            include: {
              proyecto: {
                include: {
                  cuentaBancaria: true,
                },
              },
              grupo: true,
              partida: true,
            },
          },
          actividad: true,
          codigoPresupuestario: true,
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    const lastPage = Math.ceil(total / limit);

    // Una sola consulta groupBy para todos los POAs (elimina N+1)
    const enrichedData = await this.batchEnrichWithSaldos(data);

    return {
      data: enrichedData,
      meta: {
        total,
        page,
        lastPage,
      },
    };
  }

  async findOne(id: number): Promise<PoaWithSaldo<PoaDetailed>> {
    const poa = await this.prisma.poa.findFirst({
      where: { id, deletedAt: null },
      include: {
        estructura: {
          include: {
            proyecto: {
              include: {
                cuentaBancaria: true,
              },
            },
            grupo: true,
            partida: true,
          },
        },
        actividad: true,
        codigoPresupuestario: true,
      },
    });

    if (!poa) {
      throw new NotFoundException(`POA con ID ${id} no encontrado`);
    }

    return this.addSaldoDisponible(poa as PoaDetailed);
  }

  async create(createPoaDto: CreatePoaDto) {
    const {
      proyectoId,
      grupoId,
      partidaId,
      actividadId,
      codigoPresupuestarioId,
      cantidad,
      costoUnitario,
      ...rest
    } = createPoaDto;

    const estructura = await this.prisma.estructuraProgramatica.upsert({
      where: {
        proyectoId_grupoId_partidaId: {
          proyectoId,
          grupoId,
          partidaId,
        },
      },
      update: {},
      create: {
        proyectoId,
        grupoId,
        partidaId,
      },
    });

    const costoTotal = new Prisma.Decimal(cantidad).mul(costoUnitario);

    return this.prisma.poa.create({
      data: {
        ...rest,
        cantidad,
        costoUnitario,
        costoTotal,
        estructuraId: estructura.id,
        actividadId,
        codigoPresupuestarioId,
      },
    });
  }

  async update(id: number, updatePoaDto: UpdatePoaDto) {
    const existingPoa = await this.findOne(id);

    const { proyectoId, grupoId, partidaId, cantidad, costoUnitario, ...rest } =
      updatePoaDto;

    const updateData: Prisma.PoaUpdateInput = { ...rest };

    if (proyectoId || grupoId || partidaId) {
      const pId = proyectoId ?? existingPoa.estructura.proyectoId;
      const gId = grupoId ?? existingPoa.estructura.grupoId;
      const prId = partidaId ?? existingPoa.estructura.partidaId;

      const estructura = await this.prisma.estructuraProgramatica.upsert({
        where: {
          proyectoId_grupoId_partidaId: {
            proyectoId: pId,
            grupoId: gId,
            partidaId: prId,
          },
        },
        update: {},
        create: {
          proyectoId: pId,
          grupoId: gId,
          partidaId: prId,
        },
      });
      updateData.estructura = { connect: { id: estructura.id } };
    }

    const cantFinal = cantidad ?? existingPoa.cantidad;
    const unitFinal =
      costoUnitario != null
        ? new Prisma.Decimal(costoUnitario)
        : existingPoa.costoUnitario;

    updateData.cantidad = cantFinal;
    updateData.costoUnitario = unitFinal;
    updateData.costoTotal = new Prisma.Decimal(cantFinal).mul(unitFinal);

    return this.prisma.poa.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.poa.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async restore(id: number) {
    const poa = await this.prisma.poa.findUnique({
      where: { id },
    });

    if (!poa) {
      throw new NotFoundException(`POA con ID ${id} no encontrado`);
    }

    return this.prisma.poa.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  async getProyectosActivos() {
    return this.prisma.proyecto.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: 'asc' },
    });
  }

  async getGruposPorProyecto(proyectoId: number) {
    const estructuras = await this.prisma.estructuraProgramatica.findMany({
      where: { proyectoId },
      distinct: ['grupoId'],
      select: {
        grupo: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    return estructuras.map((e) => e.grupo);
  }

  async getPartidasConSaldo(proyectoId: number, grupoId: number) {
    const estructuras = await this.prisma.estructuraProgramatica.findMany({
      where: { proyectoId, grupoId },
      include: {
        partida: true,
        poas: {
          where: {
            estado: EstadoPoa.ACTIVO,
            deletedAt: null,
          },
        },
      },
    });

    // Recopilar todos los IDs de POA en una sola pasada
    const todosLosPoas = estructuras.flatMap((e) => e.poas);

    // Una sola consulta groupBy para todos los POAs (elimina N+1)
    const poasEnriquecidos = await this.batchEnrichWithSaldos(todosLosPoas);

    // Indexar por id para O(1) al rearmar por estructura
    const enrichedMap = new Map(poasEnriquecidos.map((p) => [p.id, p]));

    return estructuras.map((e) => {
      const saldoTotalPartida = e.poas.reduce((acc, poa) => {
        const enriquecido = enrichedMap.get(poa.id);
        return acc + (enriquecido?.saldoDisponible ?? 0);
      }, 0);

      return {
        id: e.partida.id,
        nombre: e.partida.nombre,
        saldoDisponible: saldoTotalPartida,
      };
    });
  }

  async getItemsPorPartida(
    proyectoId: number,
    grupoId: number,
    partidaId: number,
  ) {
    return this.prisma.poa.findMany({
      where: {
        estado: EstadoPoa.ACTIVO,
        deletedAt: null,
        estructura: {
          proyectoId,
          grupoId,
          partidaId,
        },
      },
      include: {
        actividad: true,
        codigoPresupuestario: true,
      },
    });
  }

  async getLookup(): Promise<PoaLookupDto[]> {
    const poas = await this.prisma.poa.findMany({
      where: { deletedAt: null },
      distinct: ['codigoPoa'],
      select: {
        codigoPoa: true,
      },
      orderBy: { codigoPoa: 'asc' },
    });

    return poas.map((poa) => ({
      codigo: poa.codigoPoa,
    }));
  }

  async findDetailByStructure(
    codigoPoa: string,
    proyectoId: number,
    grupoId: number,
    partidaId: number,
    codigoPresupuestarioId: number,
  ) {
    const poa = await this.prisma.poa.findFirst({
      where: {
        codigoPresupuestarioId,
        deletedAt: null,
        estructura: {
          proyectoId,
          grupoId,
          partidaId,
        },
      },
      select: {
        id: true,
        costoTotal: true,
        actividad: {
          select: {
            detalleDescripcion: true,
          },
        },
      },
    });

    if (!poa) return null;

    return {
      id: poa.id,
      costoTotal: poa.costoTotal,
      descripcion: poa.actividad.detalleDescripcion,
    };
  }

  async getStructureByPoa(codigoPoa: string) {
    const poas = await this.prisma.poa.findMany({
      where: {
        codigoPoa,
        deletedAt: null,
      },
      select: {
        id: true,
        codigoPoa: true,
        cantidad: true,
        costoUnitario: true,
        costoTotal: true,
        actividad: {
          select: {
            id: true,
            detalleDescripcion: true,
          },
        },
        codigoPresupuestario: {
          select: {
            id: true,
            codigoCompleto: true,
          },
        },
        estructura: {
          select: {
            proyecto: {
              select: {
                id: true,
                nombre: true,
                cuentaBancaria: true,
              },
            },
            grupo: {
              select: {
                id: true,
                nombre: true,
              },
            },
            partida: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return Promise.all(poas.map((poa) => this.addSaldoDisponible(poa)));
  }
}
