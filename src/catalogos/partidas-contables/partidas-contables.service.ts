import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PartidasContablesService {
  constructor(private prisma: PrismaService) {}

  async search(q: string) {
    return this.prisma.partidaContable.findMany({
      where: {
        deletedAt: null,
        ...(q.trim() ? { codigo: { startsWith: q.trim() } } : {}),
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        nivel: true,
      },
      orderBy: { codigo: 'asc' },
      take: 300,
    });
  }
}
