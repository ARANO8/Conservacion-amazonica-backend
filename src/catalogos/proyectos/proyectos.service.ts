import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProyectosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.proyecto.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        nombre: true,
      },
      orderBy: { nombre: 'asc' },
    });
  }

  findByPoaCode(codigo: string) {
    return this.prisma.proyecto.findMany({
      where: {
        deletedAt: null,
        estructuras: {
          some: {
            poas: {
              some: {
                codigoPoa: codigo,
                deletedAt: null,
              },
            },
          },
        },
      },
      select: {
        id: true,
        nombre: true,
      },
      distinct: ['id'],
      orderBy: { nombre: 'asc' },
    });
  }
}
