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
}
