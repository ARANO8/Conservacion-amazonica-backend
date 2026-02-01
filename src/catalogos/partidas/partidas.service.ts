import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PartidasService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.partida.findMany({
      select: {
        id: true,
        nombre: true,
      },
    });
  }

  findByGrupoId(grupoId: number) {
    return this.prisma.partida.findMany({
      where: {
        deletedAt: null,
        estructuras: {
          some: {
            grupoId,
          },
        },
      },
      distinct: ['id'],
      select: {
        id: true,
        nombre: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }
}
