import { Prisma } from '@prisma/client';
import { desglosarRetenciones } from './rendiciones.helper';

/**
 * ANEXO 4 — Rendición de Fondos en Avance.
 *
 * Estructura única de la que beben el PDF y la vista de detalle (anexo4.hbs) y
 * el Excel (anexo4.excel.ts). Los importes van como números: la plantilla los
 * formatea y el Excel los escribe como celdas numéricas con sus fórmulas.
 *
 * Terminología del anexo:
 *   EGRESOS / NETO → efectivo pagado (lo que sale de caja)
 *   TOTAL          → monto bruto, con las retenciones (lo que se carga al POA)
 */

export interface Anexo4Fila {
  fecha: string;
  nroDocto: string;
  tipoDocto: string;
  partida: string;
  descripcion: string;
  ingreso: number | null;
  egreso: number | null;
  saldo: number;
  /** Columnas de retenciones: vacías en la fila del fondo en avance */
  total: number | null;
  rcIva: number | null;
  iue: number | null;
  it: number | null;
  totalImpuestos: number | null;
  neto: number | null;
  esFondo: boolean;
}

export interface Anexo4Firma {
  nombre: string;
  cargo: string;
}

export interface Anexo4 {
  codigoSolicitud: string;
  a: string;
  de: string;
  proyecto: string;
  codigoActividad: string;
  chequeANombreDe: string;
  bancoCuenta: string;
  chequeNro: string;
  fechaEntrega: string;
  fechaRendicion: string;
  filas: Anexo4Fila[];
  totales: {
    ingresos: number;
    egresos: number;
    saldo: number;
    total: number;
    rcIva: number;
    iue: number;
    it: number;
    totalImpuestos: number;
    neto: number;
  };
  observaciones: string;
  liquidacion: {
    importeRecibido: number;
    totalGastado: number;
    saldo: number;
    aFavorEmpleado: number | null;
    aFavorProyecto: number | null;
  };
  documentos: {
    facturasCantidad: number;
    facturasMonto: number;
    recibosCantidad: number;
    recibosMonto: number;
    totalCantidad: number;
    totalMonto: number;
  };
  resumenContable: { nombre: string; codigo: string; monto: number }[];
  resumenContableTotal: number;
  firmas: {
    elaboradoPor: Anexo4Firma;
    revisadoPor: Anexo4Firma;
    aprobadoPor: Anexo4Firma;
  };
}

type Decimalish = Prisma.Decimal | number | string | null | undefined;

interface PoaFuente {
  codigoPoa: string;
  estructura: {
    partida: { nombre: string } | null;
    proyecto: {
      nombre: string;
      cuentaBancaria?: { banco: string; numeroCuenta: string } | null;
    } | null;
  } | null;
}

export interface Anexo4Fuente {
  fechaRendicion: Date;
  observaciones: string | null;
  createdAt: Date;
  solicitud: {
    codigoSolicitud: string;
    codigoDesembolso: string | null;
    fechaDesembolso: Date | null;
    fechaSolicitud: Date | null;
    montoTotalNeto: Decimalish;
    chequeANombreDe: string | null;
    proyecto: string | null;
    usuarioEmisor: { nombreCompleto: string; cargo: string | null } | null;
    directorPrograma: { nombreCompleto: string } | null;
    presupuestos: { poa: PoaFuente | null }[];
  };
  gastosRendicion: {
    fecha: Date | null;
    nroDocumento: string;
    tipoDocumento: string;
    tipoRetencion: string | null;
    concepto: string;
    detalle: string;
    montoBruto: Decimalish;
    montoImpuestos: Decimalish;
    montoNeto: Decimalish;
    partida: { poa: PoaFuente | null } | null;
    partidaContable: { codigo: string; nombre: string } | null;
  }[];
  declaracionesJuradas: {
    fecha: Date | null;
    detalle: string;
    monto: Decimalish;
  }[];
}

const TIPOS_DOCUMENTO: Record<string, string> = {
  FACTURA: 'Factura',
  RECIBO: 'Recibo',
  BOLETA: 'Boleta',
  LV: 'Liq. viáticos',
  DJ: 'Decl. jurada',
  PPT: 'Planilla pasajes',
  PAT: 'Planilla alimentación',
  PVT: 'Planilla viáticos',
};

function num(value: Decimalish): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function fecha(value: Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function construirAnexo4(
  fuente: Anexo4Fuente,
  opciones: {
    destinatario: string;
    revisadoPor: Anexo4Firma;
    aprobadoPor: Anexo4Firma;
  },
): Anexo4 {
  const { solicitud } = fuente;
  const importeRecibido = round2(num(solicitud.montoTotalNeto));
  const emisor = solicitud.usuarioEmisor?.nombreCompleto ?? '';

  // Gastos con respaldo y declaraciones juradas, en orden cronológico
  const movimientos = [
    ...fuente.gastosRendicion.map((g) => {
      const desglose = desglosarRetenciones(
        num(g.montoImpuestos),
        g.tipoDocumento,
        g.tipoRetencion,
        g.partida?.poa?.estructura?.partida?.nombre,
      );
      return {
        cuando: g.fecha ?? fuente.fechaRendicion,
        nroDocto: g.nroDocumento,
        tipoDocumento: g.tipoDocumento,
        partida: g.partida?.poa?.estructura?.partida?.nombre ?? '',
        descripcion: g.concepto || g.detalle,
        bruto: num(g.montoBruto),
        impuestos: num(g.montoImpuestos),
        neto: num(g.montoNeto),
        rcIva: desglose.rcIva.toNumber(),
        iue: desglose.iue.toNumber(),
        it: desglose.it.toNumber(),
        contable: g.partidaContable,
      };
    }),
    ...fuente.declaracionesJuradas.map((dj) => ({
      cuando: dj.fecha ?? fuente.fechaRendicion,
      nroDocto: '',
      tipoDocumento: 'DJ',
      partida: '',
      descripcion: dj.detalle,
      bruto: num(dj.monto),
      impuestos: 0,
      neto: num(dj.monto),
      rcIva: 0,
      iue: 0,
      it: 0,
      contable: null as { codigo: string; nombre: string } | null,
    })),
  ].sort((a, b) => new Date(a.cuando).getTime() - new Date(b.cuando).getTime());

  const filas: Anexo4Fila[] = [
    {
      // Sin fecha de desembolso registrada (datos antiguos) queda vacía: la
      // fecha de la solicitud no es la de la entrega de fondos
      fecha: fecha(solicitud.fechaDesembolso),
      nroDocto: solicitud.codigoDesembolso ?? '',
      tipoDocto: '',
      partida: '',
      descripcion: 'FONDO EN AVANCE',
      ingreso: importeRecibido,
      egreso: null,
      saldo: importeRecibido,
      total: null,
      rcIva: null,
      iue: null,
      it: null,
      totalImpuestos: null,
      neto: null,
      esFondo: true,
    },
  ];

  // El saldo sigue el efectivo: es lo que se devuelve o reembolsa al liquidar
  let saldo = importeRecibido;
  const documentos = {
    facturasCantidad: 0,
    facturasMonto: 0,
    recibosCantidad: 0,
    recibosMonto: 0,
  };
  const contable = new Map<
    string,
    { nombre: string; codigo: string; monto: number }
  >();

  for (const m of movimientos) {
    saldo = round2(saldo - m.neto);
    filas.push({
      fecha: fecha(m.cuando),
      nroDocto: m.nroDocto,
      tipoDocto: TIPOS_DOCUMENTO[m.tipoDocumento] ?? m.tipoDocumento,
      partida: m.partida,
      descripcion: m.descripcion,
      ingreso: null,
      egreso: round2(m.neto),
      saldo,
      total: round2(m.bruto),
      rcIva: round2(m.rcIva),
      iue: round2(m.iue),
      it: round2(m.it),
      totalImpuestos: round2(m.impuestos),
      neto: round2(m.neto),
      esFondo: false,
    });

    if (m.tipoDocumento === 'FACTURA') {
      documentos.facturasCantidad += 1;
      documentos.facturasMonto += m.neto;
    } else {
      documentos.recibosCantidad += 1;
      documentos.recibosMonto += m.neto;
    }

    // Resumen contable: por partida del plan de cuentas, al monto bruto
    const clave = m.contable?.codigo ?? '';
    const actual = contable.get(clave) ?? {
      nombre: m.contable?.nombre ?? 'Sin partida contable asignada',
      codigo: m.contable?.codigo ?? '',
      monto: 0,
    };
    actual.monto = round2(actual.monto + m.bruto);
    contable.set(clave, actual);
  }

  const suma = (sel: (f: Anexo4Fila) => number | null) =>
    round2(filas.reduce((acc, f) => acc + (sel(f) ?? 0), 0));

  const egresos = suma((f) => f.egreso);
  const saldoFinal = round2(importeRecibido - egresos);

  const poas = solicitud.presupuestos
    .map((p) => p.poa)
    .filter((poa): poa is PoaFuente => !!poa);
  const proyectos = [
    ...new Set(
      poas
        .map((poa) => poa.estructura?.proyecto?.nombre)
        .filter((n): n is string => !!n),
    ),
  ];
  const cuenta = poas.find((poa) => poa.estructura?.proyecto?.cuentaBancaria)
    ?.estructura?.proyecto?.cuentaBancaria;

  const resumenContable = [...contable.values()];

  return {
    codigoSolicitud: solicitud.codigoSolicitud,
    a: opciones.destinatario,
    de: solicitud.directorPrograma?.nombreCompleto ?? emisor,
    proyecto: solicitud.proyecto?.trim() || proyectos.join(', '),
    codigoActividad: [...new Set(poas.map((poa) => poa.codigoPoa))].join(', '),
    chequeANombreDe: solicitud.chequeANombreDe?.trim() || emisor,
    bancoCuenta: cuenta ? `${cuenta.banco} ${cuenta.numeroCuenta}` : '',
    chequeNro: solicitud.codigoDesembolso ?? '',
    fechaEntrega: fecha(solicitud.fechaDesembolso),
    fechaRendicion: fecha(fuente.fechaRendicion ?? fuente.createdAt),
    filas,
    totales: {
      ingresos: suma((f) => f.ingreso),
      egresos,
      saldo: saldoFinal,
      total: suma((f) => f.total),
      rcIva: suma((f) => f.rcIva),
      iue: suma((f) => f.iue),
      it: suma((f) => f.it),
      totalImpuestos: suma((f) => f.totalImpuestos),
      neto: suma((f) => f.neto),
    },
    observaciones: fuente.observaciones ?? '',
    liquidacion: {
      importeRecibido,
      totalGastado: egresos,
      saldo: saldoFinal,
      aFavorEmpleado: saldoFinal < 0 ? Math.abs(saldoFinal) : null,
      aFavorProyecto: saldoFinal > 0 ? saldoFinal : null,
    },
    documentos: {
      facturasCantidad: documentos.facturasCantidad,
      facturasMonto: round2(documentos.facturasMonto),
      recibosCantidad: documentos.recibosCantidad,
      recibosMonto: round2(documentos.recibosMonto),
      totalCantidad: documentos.facturasCantidad + documentos.recibosCantidad,
      totalMonto: round2(documentos.facturasMonto + documentos.recibosMonto),
    },
    resumenContable,
    resumenContableTotal: round2(
      resumenContable.reduce((acc, r) => acc + r.monto, 0),
    ),
    firmas: {
      elaboradoPor: {
        nombre: emisor,
        cargo: solicitud.usuarioEmisor?.cargo ?? '',
      },
      revisadoPor: opciones.revisadoPor,
      aprobadoPor: opciones.aprobadoPor,
    },
  };
}
