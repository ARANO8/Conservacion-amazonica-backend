import { LOCALE_DEFAULT } from '../common/constants/financial.constants';
import { MIN_FILAS_ANEXO1 } from './planes-viaje.constants';

/** Lo mínimo del plan que necesita el ANEXO 1 impreso. */
export interface Anexo1Fuente {
  codigoPlan: string;
  cargo: string;
  lugaresViaje: string;
  objetivoViaje: string;
  lugarEmision: string;
  fechaEmision: Date;
  usuario: { nombreCompleto: string };
  directorPrograma: { nombreCompleto: string } | null;
  actividades: {
    fechaInicio: Date;
    fechaFin: Date;
    lugarSalida: string | null;
    lugarLlegada: string | null;
    actividadProgramada: string;
    cantidadPersonasTerceros: number;
    participantesInstitucionales: { nombreCompleto: string }[];
  }[];
}

export interface Anexo1FilaCronograma {
  fechas: string;
  salida: string;
  llegada: string;
  actividad: string;
  deAceaa: string[];
  terceros: string;
}

export interface Anexo1 {
  codigoPlan: string;
  nombre: string;
  cargo: string;
  lugaresViaje: string;
  objetivoViaje: string;
  filas: Anexo1FilaCronograma[];
  lugarEmision: string;
  fechaEmision: string;
  responsable: string;
  directorPrograma: string;
}

/**
 * Las fechas del plan son de calendario, no instantes: formatearlas en la
 * zona local las correría un día en Bolivia (UTC-4).
 */
export function formatFechaAnexo(fecha: Date): string {
  return fecha.toLocaleDateString(LOCALE_DEFAULT, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "03/11/2026" si es un solo día; si no, "03/11/2026 al 05/11/2026". */
function rangoFechas(inicio: Date, fin: Date): string {
  const desde = formatFechaAnexo(inicio);
  const hasta = formatFechaAnexo(fin);
  return desde === hasta ? desde : `${desde} al ${hasta}`;
}

function filaVacia(): Anexo1FilaCronograma {
  return {
    fechas: '',
    salida: '',
    llegada: '',
    actividad: '',
    deAceaa: [],
    terceros: '',
  };
}

export function construirAnexo1(fuente: Anexo1Fuente): Anexo1 {
  const filas: Anexo1FilaCronograma[] = fuente.actividades.map((a) => ({
    fechas: rangoFechas(a.fechaInicio, a.fechaFin),
    salida: a.lugarSalida ?? '',
    llegada: a.lugarLlegada ?? '',
    actividad: a.actividadProgramada,
    deAceaa: a.participantesInstitucionales.map((p) => p.nombreCompleto),
    // Los terceros se cuentan: sus nombres van en la nómina de la solicitud
    terceros:
      a.cantidadPersonasTerceros > 0 ? String(a.cantidadPersonasTerceros) : '',
  }));

  while (filas.length < MIN_FILAS_ANEXO1) filas.push(filaVacia());

  return {
    codigoPlan: fuente.codigoPlan,
    nombre: fuente.usuario.nombreCompleto,
    cargo: fuente.cargo,
    lugaresViaje: fuente.lugaresViaje,
    objetivoViaje: fuente.objetivoViaje,
    filas,
    lugarEmision: fuente.lugarEmision,
    fechaEmision: formatFechaAnexo(fuente.fechaEmision),
    responsable: fuente.usuario.nombreCompleto,
    directorPrograma: fuente.directorPrograma?.nombreCompleto ?? '',
  };
}
