import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
}
