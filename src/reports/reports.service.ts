import { Injectable } from '@nestjs/common';
import { TDocumentDefinitions, CustomTableLayout } from 'pdfmake/interfaces';
import { formatDate, formatCurrency } from '../shared/utils/formatters.util';

// Definición de interfaces para tipado estricto y satisfacer ESLint
export interface SolicitudReportData {
  codigoSolicitud: string;
  lugarViaje?: string | null;
  motivoViaje?: string | null;
  fechaInicio?: Date | string | null;
  fechaFin?: Date | string | null;
  montoTotalPresupuestado: number | string | { toString(): string };
  montoTotalNeto: number | string | { toString(): string };
  usuarioEmisor?: {
    nombreCompleto?: string | null;
  } | null;
  poa?: {
    actividad?: {
      detalleDescripcion?: string | null;
    } | null;
    estructura?: {
      proyecto?: {
        nombre?: string | null;
      } | null;
    } | null;
    codigoPresupuestario?: {
      codigoCompleto?: string | null;
    } | null;
  } | null;
  planificaciones?: Array<{
    fechaInicio: Date | string | null;
    fechaFin: Date | string | null;
    actividadProgramada: string;
    cantidadPersonasInstitucional: number;
    cantidadPersonasTerceros: number;
  }> | null;
  viaticos?: Array<{
    tipoDestino: string;
    dias: number;
    cantidadPersonas: number;
    costoUnitario: number | string | { toString(): string };
    montoPresupuestado: number | string | { toString(): string };
    montoNeto: number | string | { toString(): string };
    concepto?: {
      nombre?: string | null;
    } | null;
  }> | null;
  gastos?: Array<{
    detalle?: string | null;
    tipoDocumento: string;
    cantidad: number;
    costoUnitario: number | string | { toString(): string };
    montoPresupuestado: number | string | { toString(): string };
    montoNeto: number | string | { toString(): string };
    tipoGasto?: {
      nombre?: string | null;
    } | null;
  }> | null;
}

@Injectable()
export class ReportsService {
  constructor() {}

  async generateSolicitudPdf(solicitud: SolicitudReportData): Promise<Buffer> {
    // 1. Cargar el módulo (usando require para compatibilidad con pdfmake/js/printer)
    /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    const PdfPrinterLib = require('pdfmake/js/printer');
    const PdfPrinter = PdfPrinterLib.default || PdfPrinterLib;

    // 2. Fuentes Estándar (Helvetica)
    const fonts = {
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    // 3. Instanciación
    const printer = new PdfPrinter(fonts);

    const docDefinition: TDocumentDefinitions = {
      content: [
        // Encabezado
        {
          columns: [
            {
              text: 'Conservación Amazónica - ACEAA',
              style: 'orgTitle',
            },
            {
              text: [
                { text: 'SOLICITUD DE FONDOS\n', style: 'header' },
                { text: solicitud.codigoSolicitud, style: 'code' },
              ],
              alignment: 'right',
            },
          ],
        },
        {
          text: `Fecha de impresión: ${formatDate(new Date())}`,
          alignment: 'right',
          fontSize: 8,
          margin: [0, 5, 0, 15],
        },

        // Sección 1: Datos Generales
        { text: 'DATOS GENERALES', style: 'sectionHeader' },
        {
          table: {
            widths: ['25%', '75%'],
            body: [
              [
                'Solicitante:',
                {
                  text: solicitud.usuarioEmisor?.nombreCompleto || 'N/A',
                  bold: true,
                },
              ],
              [
                'Proyecto:',
                solicitud.poa?.estructura?.proyecto?.nombre || 'N/A',
              ],
              [
                'Actividad POA:',
                solicitud.poa?.actividad?.detalleDescripcion || 'N/A',
              ],
              [
                'Código Presupuestario:',
                solicitud.poa?.codigoPresupuestario?.codigoCompleto || 'N/A',
              ],
              ['Lugar del Viaje:', solicitud.lugarViaje || 'N/A'],
              ['Motivo del Viaje:', solicitud.motivoViaje || 'N/A'],
              [
                'Fechas:',
                `Del ${formatDate(solicitud.fechaInicio)} al ${formatDate(solicitud.fechaFin)}`,
              ],
            ] as any,
          },
          layout: 'noBorders' as unknown as CustomTableLayout,
          margin: [0, 0, 0, 20],
        },

        // Sección 2: Itinerario (Planificación)
        { text: 'ITINERARIO (PLANIFICACIÓN)', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['20%', '20%', '40%', '20%'],
            body: [
              [
                { text: 'Fecha Inicio', style: 'tableHeader' },
                { text: 'Fecha Fin', style: 'tableHeader' },
                { text: 'Actividad', style: 'tableHeader' },
                { text: 'Cant. Personas', style: 'tableHeader' },
              ],
              ...(solicitud.planificaciones || []).map((p) => [
                formatDate(p.fechaInicio),
                formatDate(p.fechaFin),
                p.actividadProgramada,
                `Inst: ${p.cantidadPersonasInstitucional} / Terc: ${p.cantidadPersonasTerceros}`,
              ]),
            ] as any,
          },
          margin: [0, 0, 0, 20],
        },

        // Sección 3: Detalle Económico
        { text: 'DETALLE ECONÓMICO', style: 'sectionHeader' },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Concepto / Tipo', style: 'tableHeader' },
                { text: 'Detalle', style: 'tableHeader' },
                { text: 'Cant/Días', style: 'tableHeader' },
                { text: 'Costo Unit.', style: 'tableHeader' },
                { text: 'TOTAL', style: 'tableHeader' },
              ],
              // Viáticos
              ...(solicitud.viaticos || []).map((v) => [
                `Viático: ${v.concepto?.nombre || 'N/A'}`,
                v.tipoDestino,
                `${v.dias} días x ${v.cantidadPersonas} pers`,
                formatCurrency(v.costoUnitario),
                {
                  text: formatCurrency(v.montoPresupuestado),
                  alignment: 'right',
                },
              ]),
              // Gastos
              ...(solicitud.gastos || []).map((g) => [
                `Gasto: ${g.tipoGasto?.nombre || 'N/A'}`,
                g.detalle || g.tipoDocumento,
                g.cantidad,
                formatCurrency(g.costoUnitario),
                {
                  text: formatCurrency(g.montoPresupuestado),
                  alignment: 'right',
                },
              ]),
              // Totales
              [
                {
                  text: 'TOTAL SOLICITADO',
                  colSpan: 4,
                  bold: true,
                  alignment: 'right',
                },
                {},
                {},
                {},
                {
                  text: formatCurrency(solicitud.montoTotalPresupuestado),
                  bold: true,
                  alignment: 'right',
                },
              ],
              [
                {
                  text: 'MONTO NETO',
                  colSpan: 4,
                  bold: true,
                  alignment: 'right',
                },
                {},
                {},
                {},
                {
                  text: formatCurrency(solicitud.montoTotalNeto),
                  bold: true,
                  alignment: 'right',
                  color: 'darkblue',
                },
              ],
            ] as any,
          },
          margin: [0, 0, 0, 40],
        },

        // Sección 4: Firmas
        {
          columns: [
            {
              stack: [
                { text: '', margin: [0, 50, 0, 0] },
                {
                  canvas: [
                    {
                      type: 'line',
                      x1: 0,
                      y1: 0,
                      x2: 120,
                      y2: 0,
                      lineWidth: 1,
                    },
                  ],
                },
                {
                  text: 'Solicitante',
                  alignment: 'center',
                  fontSize: 9,
                  margin: [0, 5, 0, 0],
                },
                {
                  text: solicitud.usuarioEmisor?.nombreCompleto || '',
                  alignment: 'center',
                  fontSize: 8,
                  italics: true,
                },
              ],
              alignment: 'center',
            },
            {
              stack: [
                { text: '', margin: [0, 50, 0, 0] },
                {
                  canvas: [
                    {
                      type: 'line',
                      x1: 0,
                      y1: 0,
                      x2: 120,
                      y2: 0,
                      lineWidth: 1,
                    },
                  ],
                },
                {
                  text: 'Inmediato Superior',
                  alignment: 'center',
                  fontSize: 9,
                  margin: [0, 5, 0, 0],
                },
              ],
              alignment: 'center',
            },
            {
              stack: [
                { text: '', margin: [0, 50, 0, 0] },
                {
                  canvas: [
                    {
                      type: 'line',
                      x1: 0,
                      y1: 0,
                      x2: 120,
                      y2: 0,
                      lineWidth: 1,
                    },
                  ],
                },
                {
                  text: 'Autorización (Tesorería)',
                  alignment: 'center',
                  fontSize: 9,
                  margin: [0, 5, 0, 0],
                },
              ],
              alignment: 'center',
            },
          ],
        },
      ],
      styles: {
        orgTitle: { fontSize: 10, italics: true, color: 'gray' },
        header: { fontSize: 16, bold: true },
        code: { fontSize: 14, bold: true, color: 'red' },
        sectionHeader: {
          fontSize: 12,
          bold: true,
          background: '#eeeeee',
          margin: [0, 10, 0, 10],
        },
        tableHeader: { fontSize: 10, bold: true, fillColor: '#f3f3f3' },
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
      },
    };

    let doc = printer.createPdfKitDocument(docDefinition);

    if (doc instanceof Promise) {
      doc = await doc;
    }

    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err: unknown) =>
          reject(err instanceof Error ? err : new Error(String(err))),
        );
        doc.end();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
    /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
  }
}
