import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CuentasBancariasService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.cuentaBancaria.findMany({
      orderBy: { numeroCuenta: 'asc' },
    });
  }
}
