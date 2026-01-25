import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstadoPoa } from '@prisma/client';

@Injectable()
export class GruposService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.grupo.findMany({
      select: {
        id: true,
        nombre: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  findByProyectoId(proyectoId: number) {
    return this.prisma.grupo.findMany({
      where: {
        deletedAt: null,
        estructuras: {
          some: {
            proyectoId,
            poas: {
              some: {
                deletedAt: null,
                estado: EstadoPoa.ACTIVO,
              },
            },
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
