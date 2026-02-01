import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CodigosPresupuestariosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.codigoPresupuestario.findMany({
      select: {
        id: true,
        codigoCompleto: true,
      },
      orderBy: { codigoCompleto: 'asc' },
    });
  }

  filterByStructure(
    codigoPoa: string,
    proyectoId: number,
    grupoId: number,
    partidaId: number,
  ) {
    return this.prisma.codigoPresupuestario.findMany({
      where: {
        poas: {
          some: {
            deletedAt: null,
            codigoPoa,
            estructura: {
              proyectoId,
              grupoId,
              partidaId,
            },
          },
        },
      },
      distinct: ['id'],
      select: {
        id: true,
        codigoCompleto: true,
      },
    });
  }
}
