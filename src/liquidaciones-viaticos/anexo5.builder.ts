import { Prisma } from '@prisma/client';
import { fechaEnPalabras } from '../informes-viaje/anexo7.builder';
import { formatFechaAnexo } from '../planes-viaje/anexo1.builder';
import { FirmasDireccion } from '../pdf/firmas-direccion';
import { montoEnLetrasBolivianos } from '../shared/utils/letras.util';
import {
  descripcionFila,
  escalaDeConcepto,
  importeDiaBruto,
} from './liquidacion.helper';

/** El formato impreso trae cuatro filas de viático. */
export const MIN_FILAS_ANEXO5 = 4;

type Decimalish = Prisma.Decimal | number | string;

/** Lo que necesita el ANEXO 5 de la liquidación (del viaje). */
export interface Anexo5Fuente {
  codigoLiquidacion: string;
  lugarEmision: string;
  fechaEmision: Date;
  solicitud: {
    proyecto: string | null;
    presupuestos: {
      poa: {
        codigoPoa: string;
        actividad: { detalleDescripcion: string | null } | null;
        estructura: { proyecto: { nombre: string } | null } | null;
      } | null;
    }[];
  } | null;
  hojas: Anexo5HojaFuente[];
}

export interface Anexo5HojaFuente {
  id: number;
  orden: number;
  cargo: string;
  ci: string;
  sede: string;
  via: string;
  escala: string;
  motivoViaje: string;
  destino: string;
  fechaSalida: Date;
  fechaRetorno: Date;
  totalLiquido: Decimalish;
  totalBruto: Decimalish;
  rcIva: Decimalish;
  usuario: { nombreCompleto: string };
  filas: {
    porcentaje: number;
    dias: Decimalish;
    tarifaLiquida: Decimalish;
    totalBruto: Decimalish;
    concepto: { nombre: string };
  }[];
}

export interface Anexo5Fila {
  descripcion: string;
  dias: string;
  importeDia: string;
  total: string;
}

export interface Anexo5Hoja {
  codigo: string;
  proyecto: string;
  actividad: string;
  /** "Cobija, 30 de octubre de 2026" */
  lugarYFecha: string;
  nombre: string;
  cargo: string;
  ci: string;
  sede: string;
  via: string;
  escala: string;
  motivoViaje: string;
  destino: string;
  fechaSalida: string;
  fechaRetorno: string;
  /** "No. Días Ciudad: 2.0", una por tipo de destino, como la columna izquierda */
  diasPorEscala: { escala: string; dias: string }[];
  filas: Anexo5Fila[];
  totalViatico: string;
  rcIva: string;
  totalPagar: string;
  son: string;
  /** Revisa la Dirección Financiera; aprueba el Director Ejecutivo */
  firmas: FirmasDireccion;
}

export interface Anexo5 {
  codigoLiquidacion: string;
  hojas: Anexo5Hoja[];
}

const numero = (v: Decimalish, decimales = 2) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(Number(v));

function proyectoYActividad(fuente: Anexo5Fuente) {
  const poa = fuente.solicitud?.presupuestos?.[0]?.poa;
  return {
    proyecto:
      poa?.estructura?.proyecto?.nombre ?? fuente.solicitud?.proyecto ?? '',
    actividad: poa
      ? [poa.codigoPoa, poa.actividad?.detalleDescripcion]
          .filter(Boolean)
          .join(' — ')
      : '',
  };
}

function construirHoja(
  fuente: Anexo5Fuente,
  hoja: Anexo5HojaFuente,
  firmas: FirmasDireccion,
): Anexo5Hoja {
  const filas: Anexo5Fila[] = hoja.filas.map((f) => ({
    descripcion: descripcionFila(f.concepto.nombre, f.porcentaje),
    dias: numero(f.dias, 1),
    importeDia: numero(importeDiaBruto(f.tarifaLiquida, f.porcentaje)),
    total: numero(f.totalBruto),
  }));
  while (filas.length < MIN_FILAS_ANEXO5) {
    filas.push({ descripcion: '', dias: '', importeDia: '', total: '' });
  }

  const dias = new Map<string, number>();
  for (const f of hoja.filas) {
    const escala = escalaDeConcepto(f.concepto.nombre);
    dias.set(escala, (dias.get(escala) ?? 0) + Number(f.dias));
  }

  return {
    codigo: `${fuente.codigoLiquidacion}-${hoja.orden + 1}`,
    ...proyectoYActividad(fuente),
    lugarYFecha: `${fuente.lugarEmision}, ${fechaEnPalabras(fuente.fechaEmision)}`,
    nombre: hoja.usuario.nombreCompleto,
    cargo: hoja.cargo,
    ci: hoja.ci,
    sede: hoja.sede,
    via: hoja.via,
    escala: hoja.escala,
    motivoViaje: hoja.motivoViaje,
    destino: hoja.destino,
    fechaSalida: formatFechaAnexo(hoja.fechaSalida),
    fechaRetorno: formatFechaAnexo(hoja.fechaRetorno),
    diasPorEscala: [...dias].map(([escala, d]) => ({
      escala,
      dias: numero(d, 1),
    })),
    filas,
    totalViatico: numero(hoja.totalBruto),
    rcIva: numero(hoja.rcIva),
    totalPagar: numero(hoja.totalLiquido),
    // El formulario ya rotula "SON:"; la función lo antepone
    son: montoEnLetrasBolivianos(Number(hoja.totalLiquido)).replace(
      /^SON:\s*/i,
      '',
    ),
    firmas,
  };
}

/** Todas las hojas del viaje, o solo la indicada. */
export function construirAnexo5(
  fuente: Anexo5Fuente,
  firmas: FirmasDireccion,
  soloHojaId?: number,
): Anexo5 {
  const hojas = fuente.hojas.filter(
    (h) => soloHojaId === undefined || h.id === soloHojaId,
  );
  return {
    codigoLiquidacion: fuente.codigoLiquidacion,
    hojas: hojas.map((h) => construirHoja(fuente, h, firmas)),
  };
}
