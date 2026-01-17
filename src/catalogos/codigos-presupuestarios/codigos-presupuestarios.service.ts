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
}
