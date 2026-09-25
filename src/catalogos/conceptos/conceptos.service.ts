import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TIPO_CAMBIO_USD_BOB,
  tarifaEnBolivianos,
} from '../../common/constants/financial.constants';

@Injectable()
export class ConceptosService {
  constructor(private prisma: PrismaService) {}

  /**
   * Los precios se exponen en Bs (lo que usa el wizard) junto con la tarifa
   * original y su moneda, para mostrar p. ej. "USD 90 x 6,96".
   */
  async findAll() {
    const conceptos = await this.prisma.concepto.findMany({
      select: {
        id: true,
        nombre: true,
        precioInstitucional: true,
        precioTerceros: true,
        moneda: true,
      },
      orderBy: { id: 'asc' },
    });

    return conceptos.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      moneda: c.moneda,
      tipoCambio: TIPO_CAMBIO_USD_BOB,
      precioInstitucionalOriginal: c.precioInstitucional,
      precioTercerosOriginal: c.precioTerceros,
      precioInstitucional: tarifaEnBolivianos(c.precioInstitucional, c.moneda),
      precioTerceros: tarifaEnBolivianos(c.precioTerceros, c.moneda),
    }));
  }
}
