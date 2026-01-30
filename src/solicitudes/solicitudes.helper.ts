import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import {
  CreatePlanificacionDto,
  CreateViaticoDto,
} from './dto/create-solicitud.dto';

function redondear(valor: Prisma.Decimal): Prisma.Decimal {
  return valor.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function validarLimitesViatico(
  vDto: CreateViaticoDto,
  planificacion: CreatePlanificacionDto,
): void {
  const dInicio = new Date(planificacion.fechaInicio);
  const dFin = new Date(planificacion.fechaFin);

  const oneDay = 1000 * 60 * 60 * 24;

  const diffTime = dFin.getTime() - dInicio.getTime();

  const diffDays = Math.floor(diffTime / oneDay) + 1;

  if (vDto.dias > diffDays) {
    throw new BadRequestException(
      'Los días de viático exceden la duración de la actividad planificada' +
        'Estos son los dias de la planificacion: ' +
        diffDays +
        'Estos son los dias del viatico: ' +
        vDto.dias,
    );
  }

  const totalCapacidadPlanificada =
    planificacion.cantInstitucional + planificacion.cantTerceros;

  if (vDto.cantidadPersonas > totalCapacidadPlanificada) {
    throw new BadRequestException(
      'La cantidad de personas excede lo planificado',
    );
  }
}

export function calcularMontosViaticos(
  montoNetoUnitario: Prisma.Decimal,
  dias: number,
  personas: number,
) {
  const subtotalNeto = redondear(montoNetoUnitario.mul(dias).mul(personas));

  // Grossing Up: montoTotal = montoNeto / 0.87 (Tasa Efectiva RC-IVA 13%)
  const montoPresupuestado = redondear(subtotalNeto.div(0.87));

  // El impuesto (IVA/Retención) es la diferencia
  const totalImpuestos = redondear(montoPresupuestado.sub(subtotalNeto));

  // Mantenemos iva e it para compatibilidad con la DB, asignando el total a iva (RC-IVA)
  // y dejando it en 0, o distribuyendo si fuera necesario. El usuario pide RC-IVA 13%.
  const iva = totalImpuestos;
  const it = new Prisma.Decimal(0);

  return {
    subtotalNeto,
    iva,
    it,
    montoPresupuestado,
  };
}

export function calcularMontosGastos(
  montoNetoUnitario: Prisma.Decimal,
  cantidad: number,
  tipoDocumento: string,
  codigoTipoGasto?: string,
) {
  const subtotalNeto = redondear(montoNetoUnitario.mul(cantidad));
  let factor = 1.0;

  if (tipoDocumento === 'RECIBO') {
    switch (codigoTipoGasto) {
      case 'COMPRA':
        factor = 0.92; // 8% Retención (5% IUE + 3% IT)
        break;
      case 'SERVICIO':
      case 'ALQUILER':
        factor = 0.84; // 16% Retención (13% RC-IVA/IUE + 3% IT)
        break;
      case 'PEAJE':
      case 'AUTO_COMPRA':
        factor = 1.0;
        break;
      default:
        factor = 1.0;
        break;
    }
  }

  // Grossing Up: Total = Neto / Factor
  const montoPresupuestado = redondear(subtotalNeto.div(factor));
  const totalTax = redondear(montoPresupuestado.sub(subtotalNeto));

  let iva = new Prisma.Decimal(0);
  let it = new Prisma.Decimal(0);
  let iue = new Prisma.Decimal(0);

  if (totalTax.gt(0)) {
    if (codigoTipoGasto === 'COMPRA') {
      // 5% IUE, 3% IT de la base bruta (Total)
      // totalTax = Total * 0.08
      // iue = Total * 0.05 = totalTax * (5/8)
      // it = Total * 0.03 = totalTax * (3/8)
      iue = redondear(totalTax.mul(5).div(8));
      it = redondear(totalTax.sub(iue)); // Para evitar errores de redondeo
    } else if (
      codigoTipoGasto === 'SERVICIO' ||
      codigoTipoGasto === 'ALQUILER'
    ) {
      // 13% IVA (o IUE-Servicios), 3% IT
      // iue/iva = Total * 0.13 = totalTax * (13/16)
      // it = Total * 0.03 = totalTax * (3/16)
      iva = redondear(totalTax.mul(13).div(16));
      it = redondear(totalTax.sub(iva));
    }
  }

  return {
    subtotalNeto,
    iva,
    it,
    iue,
    montoPresupuestado,
  };
}
