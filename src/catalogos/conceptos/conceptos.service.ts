import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConceptosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.concepto.findMany({
      select: {
        id: true,
        nombre: true,
        precioInstitucional: true,
        precioTerceros: true,
      },
      orderBy: { id: 'asc' },
    });
  }
}
