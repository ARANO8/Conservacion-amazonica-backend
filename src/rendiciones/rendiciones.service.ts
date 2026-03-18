import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoRendicion,
  EstadoSolicitud,
  Prisma,
  TipoDocumento,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRendicionDto } from './dto/create-rendicion.dto';

@Injectable()
export class RendicionesService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySolicitudId(solicitudId: number) {
    const rendicion = await this.prisma.rendicion.findUnique({
      where: { solicitudId },
      include: {
        solicitud: true,
        gastosRendicion: true,
        declaracionesJuradas: true,
        informeGastos: {
          include: {
            actividades: true,
          },
        },
      },
    });

    if (!rendicion) {
      throw new NotFoundException(
        'No se encontró una rendición para la solicitud indicada',
      );
    }

    return rendicion;
  }

  async create(dto: CreateRendicionDto, usuarioId: number) {
    void usuarioId;

    return this.prisma.$transaction(async (tx) => {
      const solicitud = await tx.solicitud.findUnique({
        where: { id: dto.solicitudId },
        include: {
          rendicion: true,
        },
      });

      if (!solicitud || solicitud.deletedAt) {
        throw new NotFoundException('Solicitud no encontrada');
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

      const totalRespaldado = this.calcularTotalRespaldado(dto);
      const saldoLiquido = new Prisma.Decimal(solicitud.montoTotalNeto).minus(
        totalRespaldado,
      );

      const rendicion = await tx.rendicion.create({
        data: {
          solicitudId: dto.solicitudId,
          fechaRendicion: dto.fechaRendicion,
          estado: EstadoRendicion.PENDIENTE,
          urlCuadroComparativo: dto.urlCuadroComparativo,
          urlCotizaciones: dto.urlCotizaciones ?? [],
          observaciones:
            dto.observaciones ?? dto.declaracionJurada?.observaciones,
          montoRespaldado: totalRespaldado,
          saldoLiquido,
          gastosRendicion: {
            create: (dto.gastos ?? []).map((gasto) => ({
              tipoDocumento: this.toTipoDocumento(gasto.tipoDocumento),
              nroDocumento: gasto.numeroDocumento ?? 'S/N',
              fecha: gasto.fechaDocumento ?? dto.fechaRendicion,
              detalle: gasto.detalle ?? gasto.concepto,
              monto: new Prisma.Decimal(gasto.montoTotal),
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

      await tx.solicitud.update({
        where: { id: dto.solicitudId },
        data: {
          estado: EstadoSolicitud.EJECUTADO,
          observacion:
            dto.declaracionJurada?.observaciones ?? solicitud.observacion,
        },
      });

      return rendicion;
    });
  }

  private toTipoDocumento(tipoDocumento: string): TipoDocumento {
    if (tipoDocumento === TipoDocumento.FACTURA) return TipoDocumento.FACTURA;
    return TipoDocumento.RECIBO;
  }

  private calcularTotalRespaldado(dto: CreateRendicionDto): Prisma.Decimal {
    const totalGastos = (dto.gastos ?? []).reduce(
      (acc, gasto) => acc.plus(new Prisma.Decimal(gasto.montoTotal)),
      new Prisma.Decimal(0),
    );

    const totalSinRespaldo = (dto.gastosSinRespaldo ?? []).reduce(
      (acc, declaracion) => acc.plus(new Prisma.Decimal(declaracion.monto)),
      new Prisma.Decimal(0),
    );

    return totalGastos.plus(totalSinRespaldo);
  }
}
