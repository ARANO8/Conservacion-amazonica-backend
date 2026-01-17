import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TipoGastosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.tipoGasto.findMany({
      select: {
        id: true,
        nombre: true,
        codigo: true,
      },
      orderBy: { id: 'asc' },
    });
  }
}
