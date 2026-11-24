import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PartidasContablesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.partidaContable.findMany({
      where: { deletedAt: null },
      orderBy: { codigo: 'asc' },
    });
  }

  /**
   * `esEncabezado` marca las cuentas que agrupan a otras (EGRESOS, GASTOS
   * GENERALES...): ordenan el plan pero no reciben gastos, así que el
   * buscador las muestra sin dejar elegirlas.
   */
  async search(q: string) {
    const partidas = await this.prisma.partidaContable.findMany({
      where: {
        deletedAt: null,
        ...(q.trim() ? { codigo: { startsWith: q.trim() } } : {}),
      },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        nivel: true,
        _count: {
          select: { children: { where: { deletedAt: null } } },
        },
      },
      orderBy: { codigo: 'asc' },
      take: 300,
    });

    return partidas.map(({ _count, ...partida }) => ({
      ...partida,
      esEncabezado: _count.children > 0,
    }));
  }
}
