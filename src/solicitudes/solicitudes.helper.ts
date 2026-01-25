import { Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import {
  CreatePlanificacionDto,
  CreateViaticoDto,
} from './dto/create-solicitud.dto';

import {
  IVA_RATE,
  IT_RATE,
  IUE_COMPRA_RATE,
} from '../common/constants/financial.constants';

/**
 * Redondea un Decimal a 2 posiciones decimales.
 */
function redondear(valor: Prisma.Decimal): Prisma.Decimal {
  return valor.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Valida que un viático esté dentro de los límites de su planificación.
 */
export function validarLimitesViatico(
  vDto: CreateViaticoDto,
  planificacion: CreatePlanificacionDto,
): void {
  const dInicio = new Date(planificacion.fechaInicio);
  const dFin = new Date(planificacion.fechaFin);

  // Cálculo de días duración (IDEM a SolicitudesService)
  const diffDays = Math.ceil(
    (dFin.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (vDto.dias > diffDays) {
    throw new BadRequestException(
      'Los días de viático exceden la duración de la actividad planificada',
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

/**
 * Calcula montos para viáticos basándose en lógica ADITIVA.
 * Retorna { subtotalNeto, iva, it, montoPresupuestado } redondeados.
 */
export function calcularMontosViaticos(
  montoNetoUnitario: Prisma.Decimal,
  dias: number,
  personas: number,
) {
  const subtotalNeto = redondear(montoNetoUnitario.mul(dias).mul(personas));
  const iva = redondear(subtotalNeto.mul(IVA_RATE));
  const it = redondear(subtotalNeto.mul(IT_RATE));
  const montoPresupuestado = redondear(subtotalNeto.add(iva).add(it));

  return {
    subtotalNeto,
    iva,
    it,
    montoPresupuestado,
  };
}

/**
 * Calcula montos para gastos basándose en lógica ADITIVA y tipo de documento.
 * Retorna { subtotalNeto, iva, it, iue, montoPresupuestado } redondeados.
 */
export function calcularMontosGastos(
  montoNetoUnitario: Prisma.Decimal,
  cantidad: number,
  tipoDocumento: string,
  codigoTipoGasto?: string,
) {
  const subtotalNeto = redondear(montoNetoUnitario.mul(cantidad));
  let iva = new Prisma.Decimal(0);
  let it = new Prisma.Decimal(0);
  let iue = new Prisma.Decimal(0);

  if (tipoDocumento === 'RECIBO') {
    if (codigoTipoGasto === 'COMPRA') {
      iue = redondear(subtotalNeto.mul(IUE_COMPRA_RATE));
      it = redondear(subtotalNeto.mul(IT_RATE));
    } else if (
      codigoTipoGasto === 'ALQUILER' ||
      codigoTipoGasto === 'SERVICIO'
    ) {
      iva = redondear(subtotalNeto.mul(IVA_RATE));
      it = redondear(subtotalNeto.mul(IT_RATE));
    }
  }

  const montoPresupuestado = redondear(subtotalNeto.add(iva).add(it).add(iue));

  return {
    subtotalNeto,
    iva,
    it,
    iue,
    montoPresupuestado,
  };
}
