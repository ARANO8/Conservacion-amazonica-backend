import { MIN_FILAS_ANEXO7, NOTA_ANEXO7 } from './informes-viaje.constants';
import { formatFechaAnexo } from '../planes-viaje/anexo1.builder';

/** Lo mínimo del informe que necesita el ANEXO 7 impreso. */
export interface Anexo7Fuente {
  codigoInforme: string;
  motivoViaje: string;
  lugarViaje: string;
  fechaInicio: Date;
  fechaFin: Date;
  lugarEmision: string;
  fechaEmision: Date;
  usuario: { nombreCompleto: string };
  directorPrograma: { nombreCompleto: string } | null;
  actividades: {
    fecha: Date;
    lugar: string;
    personaInstitucion: string;
    actividadesRealizadas: string;
  }[];
}

export interface Anexo7Fila {
  fecha: string;
  lugar: string;
  personaInstitucion: string;
  actividadesRealizadas: string;
}

export interface Anexo7 {
  codigoInforme: string;
  destinatario: string;
  de: string;
  motivoViaje: string;
  lugarViaje: string;
  fechaDel: string;
  fechaAl: string;
  filas: Anexo7Fila[];
  lugarEmision: string;
  fechaEmision: string;
  preparadoPor: string;
  revisadoPor: string;
  notaPie: string;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * "16 de marzo de 2026", como la celda de emisión del formato. Fecha de
 * calendario: se lee en UTC para que no se corra un día en Bolivia.
 */
export function fechaEnPalabras(fecha: Date): string {
  return `${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`;
}

function filaVacia(): Anexo7Fila {
  return {
    fecha: '',
    lugar: '',
    personaInstitucion: '',
    actividadesRealizadas: '',
  };
}

export function construirAnexo7(
  fuente: Anexo7Fuente,
  destinatario: string,
): Anexo7 {
  const filas: Anexo7Fila[] = fuente.actividades.map((a) => ({
    fecha: formatFechaAnexo(a.fecha),
    lugar: a.lugar,
    personaInstitucion: a.personaInstitucion,
    actividadesRealizadas: a.actividadesRealizadas,
  }));
  while (filas.length < MIN_FILAS_ANEXO7) filas.push(filaVacia());

  return {
    codigoInforme: fuente.codigoInforme,
    destinatario,
    de: fuente.usuario.nombreCompleto,
    motivoViaje: fuente.motivoViaje,
    lugarViaje: fuente.lugarViaje,
    fechaDel: formatFechaAnexo(fuente.fechaInicio),
    fechaAl: formatFechaAnexo(fuente.fechaFin),
    filas,
    lugarEmision: fuente.lugarEmision,
    fechaEmision: fechaEnPalabras(fuente.fechaEmision),
    preparadoPor: fuente.usuario.nombreCompleto,
    revisadoPor: fuente.directorPrograma?.nombreCompleto ?? '',
    notaPie: NOTA_ANEXO7,
  };
}
