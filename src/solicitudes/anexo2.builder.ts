import { Moneda, Prisma, TipoDestino } from '@prisma/client';
import {
  FACTOR_RETENCION_VIATICOS,
  tarifaEnBolivianos,
} from '../common/constants/financial.constants';

/**
 * ANEXO 2 — Solicitud de Fondos para Viajes.
 *
 * Estructura única de la que beben el PDF (anexo2.hbs) y la vista de detalle
 * del frontend, para que ambas muestren exactamente las mismas cifras. Los
 * importes salen ya formateados: el documento es de solo lectura.
 */

export interface Anexo2FilaViatico {
  concepto: string;
  dias: string;
  personas: string;
  tarifa: string;
  bruto: string;
  iva: string;
  neto: string;
}

export interface Anexo2Totales {
  bruto: string;
  iva: string;
  neto: string;
}

export interface Anexo2FilaOtroGasto {
  concepto: string;
  detalle: string | null;
  importe: string;
}

export interface Anexo2 {
  codigoSolicitud: string;
  a: string;
  de: string;
  proyecto: string;
  actividad: string;
  chequeANombreDe: string;
  lugarViaje: string;
  motivoViaje: string;
  fechaSalida: string;
  fechaLlegada: string;
  fechaSolicitud: string;
  viaticosInstitucionales: Anexo2FilaViatico[];
  subtotalInstitucional: Anexo2Totales;
  viaticosTerceros: Anexo2FilaViatico[];
  totalViaticos: Anexo2Totales;
  otrosGastos: Anexo2FilaOtroGasto[];
  subtotalOtrosGastos: string;
  totalGeneral: string;
  observaciones: string;
  banco: string;
  solicitadoPor: string;
  /** Director de Programa: revisa la solicitud antes de Dirección Financiera. */
  revisadoPor: string;
  viajeros: string[];
}

type Decimalish = Prisma.Decimal | number | string | null | undefined;

interface ConceptoCatalogo {
  nombre: string;
  precioInstitucional: Decimalish;
  precioTerceros: Decimalish;
  moneda: Moneda;
}

interface ViaticoFuente {
  tipoDestino: TipoDestino;
  dias: Decimalish;
  cantidadPersonas: number;
  montoPresupuestado: Decimalish;
  montoNeto: Decimalish;
  concepto: { nombre: string } | null;
}

export interface Anexo2Fuente {
  codigoSolicitud: string;
  fechaSolicitud: Date | null;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  lugarViaje: string | null;
  motivoViaje: string | null;
  descripcion: string | null;
  chequeANombreDe: string | null;
  proyecto: string | null;
  usuarioEmisor: { nombreCompleto: string; cargo: string | null } | null;
  directorPrograma: { nombreCompleto: string } | null;
  viaticos: ViaticoFuente[];
  gastos: {
    montoNeto: Decimalish;
    detalle: string | null;
    tipoGasto: { nombre: string; codigo: string } | null;
  }[];
  hospedajes: { region: string; destino: string; costoTotal: Decimalish }[];
  planificaciones: {
    participantesInstitucionales: { id: number; nombreCompleto: string }[];
  }[];
  personasExternas: { nombreCompleto: string }[];
  presupuestos: {
    poa: {
      codigoPoa: string;
      estructura: {
        proyecto: {
          nombre: string;
          cuentaBancaria: { banco: string | null } | null;
        } | null;
      } | null;
    } | null;
  }[];
}

// Factor con el que el sistema "grossea" el líquido: RC-IVA 13% para
// institucionales y terceros (Instructivo de Viaje y Viáticos, 03/08/2026)
const FACTOR_VIATICOS = Number(FACTOR_RETENCION_VIATICOS);

const INSTITUCIONALES: { codigo: string; etiqueta: string }[] = [
  { codigo: 'CIUDADES_PRINCIPALES', etiqueta: 'Viáticos para Ciudad' },
  {
    codigo: 'CIUDADES_INTERMEDIAS',
    etiqueta: 'Viáticos para ciudades Intermedias',
  },
  { codigo: 'PUEBLOS', etiqueta: 'Viáticos para pueblos' },
  { codigo: 'COMUNIDADES', etiqueta: 'Viáticos para comunidades' },
];

const TERCEROS: { codigo: string; etiqueta: string }[] = [
  {
    codigo: 'CIUDADES_PRINCIPALES',
    etiqueta:
      'Viáticos para Terceros (comunarios, autoridades municipales y tecnicos municipales) en ciudad',
  },
  {
    codigo: 'CIUDADES_INTERMEDIAS',
    etiqueta:
      'Viáticos para Terceros (comunarios, autoridades municipales y tecnicos municipales) en ciudades intermedias',
  },
];

const OTROS_GASTOS = {
  PASAJES_CIUDAD: 'Pasajes terrestres en ciudad (taxis aeropuerto)',
  PASAJES_INTERPROV: 'Pasajes terrestres interprov.',
  PASAJES_AEREOS: 'Pasajes aéreos',
  ALOJAMIENTO: 'Alojamiento con factura',
  ALOJAMIENTO_INTERMEDIO: 'Alojamiento con factura (Intermedio)',
  OTROS_SERVICIOS: 'Otros servicios',
  PEAJES: 'Peajes, migración, parqueos, paso pontón',
  LAVADO: 'Lavado de la camioneta',
  MEDICAMENTOS: 'Medicamentos de botiquin con factura (ingreso comunidades)',
  COMBUSTIBLE: 'Combustible',
  ALIMENTACION: 'Alimentación',
  MATERIAL: 'Material de escritorio, impresiones y fotocopias',
  COMUNICACIONES: 'Comunicaciones',
  GASOLINA: 'Gasolina',
  IMPREVISTOS: 'Imprevistos 5%',
} as const;

type ClaveOtroGasto = keyof typeof OTROS_GASTOS;

/** El formulario impreso deja al menos este número de renglones para firmar. */
const MIN_RENGLONES_VIAJEROS = 4;

function num(value: Decimalish): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const numberFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Importe de un renglón: el anexo muestra un guion cuando está vacío. */
function importe(value: number): string {
  return round2(value) === 0 ? '-' : numberFormat.format(value);
}

/** Importe de un total: siempre con cifra, como en el anexo. */
function total(value: number): string {
  return numberFormat.format(round2(value));
}

function cantidad(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function fecha(value: Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function filaViatico(etiqueta: string, v: ViaticoFuente): Anexo2FilaViatico {
  const dias = num(v.dias);
  const personas = v.cantidadPersonas;
  const bruto = num(v.montoPresupuestado);
  const neto = num(v.montoNeto);
  const unidades = dias * personas;

  return {
    concepto: etiqueta,
    dias: cantidad(dias),
    personas: String(personas),
    tarifa: unidades > 0 ? total(bruto / unidades) : '',
    bruto: importe(bruto),
    // Diferencia y no iva13 + it3: así el renglón siempre cuadra aunque el
    // líquido se haya editado a mano en el wizard
    iva: importe(bruto - neto),
    neto: importe(neto),
  };
}

function filaVacia(etiqueta: string, tarifa: number | null): Anexo2FilaViatico {
  return {
    concepto: etiqueta,
    dias: '',
    personas: '',
    tarifa: tarifa && tarifa > 0 ? total(tarifa) : '',
    bruto: '-',
    iva: '-',
    neto: '-',
  };
}

/** Conceptos que el formulario no trae impresos (internacionales, exterior). */
const ETIQUETAS_ADICIONALES: Record<string, string> = {
  PAISES_SUDAMERICA: 'Viáticos para países de Sudamérica',
  PAISES_NORTEAMERICA_EUROPA: 'Viáticos para países de Norteamérica - Europa',
  PAISES_LIMITROFES:
    'Viáticos para países limítrofes (Brasil, Perú, Chile, Argentina)',
  EXTERIOR: 'Viáticos para el exterior',
};

function etiquetaAdicional(
  nombre: string | undefined,
  tipo: TipoDestino,
): string {
  const base =
    (nombre && ETIQUETAS_ADICIONALES[nombre]) ??
    `Viáticos — ${nombre ?? 'Otro destino'}`;
  return tipo === TipoDestino.TERCEROS
    ? base.replace('Viáticos para', 'Viáticos para Terceros en')
    : base;
}

/**
 * Una fila fija por concepto, como en el formulario. Si hay varios viáticos
 * del mismo concepto (actividades con distinto número de días o personas),
 * se agregan renglones consecutivos con la misma etiqueta. Los conceptos que
 * el anexo no contempla (p. ej. EXTERIOR) van en renglones adicionales.
 */
function seccionViaticos(
  viaticos: ViaticoFuente[],
  fijas: { codigo: string; etiqueta: string }[],
  catalogo: ConceptoCatalogo[],
  tipo: TipoDestino,
): Anexo2FilaViatico[] {
  const factor = FACTOR_VIATICOS;
  const filas: Anexo2FilaViatico[] = [];
  const usados = new Set<ViaticoFuente>();

  for (const { codigo, etiqueta } of fijas) {
    const delConcepto = viaticos.filter((v) => v.concepto?.nombre === codigo);
    delConcepto.forEach((v) => usados.add(v));

    if (delConcepto.length === 0) {
      const concepto = catalogo.find((c) => c.nombre === codigo);
      const precio = concepto
        ? num(
            tarifaEnBolivianos(
              num(
                tipo === TipoDestino.TERCEROS
                  ? concepto.precioTerceros
                  : concepto.precioInstitucional,
              ),
              concepto.moneda,
            ),
          )
        : 0;
      filas.push(filaVacia(etiqueta, precio > 0 ? precio / factor : null));
      continue;
    }

    delConcepto.forEach((v) => filas.push(filaViatico(etiqueta, v)));
  }

  viaticos
    .filter((v) => !usados.has(v))
    .forEach((v) =>
      filas.push(filaViatico(etiquetaAdicional(v.concepto?.nombre, tipo), v)),
    );

  return filas;
}

function totales(viaticos: ViaticoFuente[]): Anexo2Totales {
  const bruto = viaticos.reduce((acc, v) => acc + num(v.montoPresupuestado), 0);
  const neto = viaticos.reduce((acc, v) => acc + num(v.montoNeto), 0);
  return { bruto: total(bruto), iva: total(bruto - neto), neto: total(neto) };
}

/**
 * El catálogo de tipos de gasto no distingue los conceptos del anexo: solo
 * los peajes y el alojamiento tienen fila propia, el resto va a
 * "Otros servicios" con su detalle.
 */
function clasificarOtrosGastos(fuente: Anexo2Fuente): Anexo2FilaOtroGasto[] {
  const importes = new Map<ClaveOtroGasto, number>();
  const detalles = new Map<ClaveOtroGasto, string[]>();

  const sumar = (clave: ClaveOtroGasto, monto: number, detalle?: string) => {
    importes.set(clave, (importes.get(clave) ?? 0) + monto);
    const texto = detalle?.trim();
    if (texto) detalles.set(clave, [...(detalles.get(clave) ?? []), texto]);
  };

  for (const gasto of fuente.gastos) {
    const clave: ClaveOtroGasto =
      gasto.tipoGasto?.codigo === 'PEAJE' ? 'PEAJES' : 'OTROS_SERVICIOS';
    sumar(
      clave,
      num(gasto.montoNeto),
      gasto.detalle?.trim() || gasto.tipoGasto?.nombre,
    );
  }

  for (const h of fuente.hospedajes) {
    const clave: ClaveOtroGasto = /intermedi/i.test(h.region)
      ? 'ALOJAMIENTO_INTERMEDIO'
      : 'ALOJAMIENTO';
    sumar(clave, num(h.costoTotal), h.destino);
  }

  return (Object.keys(OTROS_GASTOS) as ClaveOtroGasto[]).map((clave) => {
    const monto = importes.get(clave) ?? 0;
    const lista = detalles.get(clave);
    return {
      concepto: OTROS_GASTOS[clave],
      detalle: lista?.length ? lista.join('; ') : null,
      importe: monto === 0 ? '' : total(monto),
    };
  });
}

function viajeros(fuente: Anexo2Fuente): string[] {
  const institucionales = new Map<number, string>();
  fuente.planificaciones.forEach((p) =>
    p.participantesInstitucionales.forEach((u) =>
      institucionales.set(u.id, u.nombreCompleto),
    ),
  );

  const terceros = [
    ...new Set(fuente.personasExternas.map((p) => p.nombreCompleto)),
  ];

  const nombres = [...institucionales.values(), ...terceros];
  while (nombres.length < MIN_RENGLONES_VIAJEROS) nombres.push('');
  return nombres;
}

export function construirAnexo2(
  fuente: Anexo2Fuente,
  catalogo: ConceptoCatalogo[],
  destinatario: string,
): Anexo2 {
  const institucionales = fuente.viaticos.filter(
    (v) => v.tipoDestino !== TipoDestino.TERCEROS,
  );
  const terceros = fuente.viaticos.filter(
    (v) => v.tipoDestino === TipoDestino.TERCEROS,
  );

  const otrosGastos = clasificarOtrosGastos(fuente);
  const subtotalOtros =
    fuente.gastos.reduce((acc, g) => acc + num(g.montoNeto), 0) +
    fuente.hospedajes.reduce((acc, h) => acc + num(h.costoTotal), 0);
  const totalNetoViaticos = fuente.viaticos.reduce(
    (acc, v) => acc + num(v.montoNeto),
    0,
  );

  const poas = fuente.presupuestos
    .map((p) => p.poa)
    .filter((poa): poa is NonNullable<typeof poa> => !!poa);
  const proyectos = [
    ...new Set(
      poas
        .map((poa) => poa.estructura?.proyecto?.nombre)
        .filter((nombre): nombre is string => !!nombre),
    ),
  ];
  const banco =
    poas.find((poa) => poa.estructura?.proyecto?.cuentaBancaria?.banco)
      ?.estructura?.proyecto?.cuentaBancaria?.banco ?? '';

  const emisor = fuente.usuarioEmisor?.nombreCompleto ?? '';

  return {
    codigoSolicitud: fuente.codigoSolicitud,
    a: destinatario,
    // DE: el Director de Programa, que revisa y presenta la solicitud. Las
    // solicitudes sin director (compras, datos antiguos) caen al emisor.
    de: fuente.directorPrograma?.nombreCompleto ?? emisor,
    proyecto: fuente.proyecto?.trim() || proyectos.join(', '),
    actividad: [...new Set(poas.map((poa) => poa.codigoPoa))].join(', '),
    chequeANombreDe: fuente.chequeANombreDe?.trim() || emisor,
    lugarViaje: fuente.lugarViaje ?? '',
    motivoViaje: fuente.motivoViaje ?? '',
    fechaSalida: fecha(fuente.fechaInicio),
    fechaLlegada: fecha(fuente.fechaFin),
    fechaSolicitud: fecha(fuente.fechaSolicitud),
    viaticosInstitucionales: [
      ...seccionViaticos(
        institucionales,
        INSTITUCIONALES,
        catalogo,
        TipoDestino.INSTITUCIONAL,
      ),
      // Renglón libre que el formulario deja al final de la sección
      filaVacia('', null),
    ],
    subtotalInstitucional: totales(institucionales),
    viaticosTerceros: seccionViaticos(
      terceros,
      TERCEROS,
      catalogo,
      TipoDestino.TERCEROS,
    ),
    totalViaticos: totales(fuente.viaticos),
    otrosGastos,
    subtotalOtrosGastos: total(subtotalOtros),
    totalGeneral: total(totalNetoViaticos + subtotalOtros),
    observaciones: fuente.descripcion ?? '',
    banco,
    solicitadoPor: emisor,
    revisadoPor: fuente.directorPrograma?.nombreCompleto ?? '',
    viajeros: viajeros(fuente),
  };
}
