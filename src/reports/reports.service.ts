import { Injectable } from '@nestjs/common';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
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
    cargo?: string | null;
  } | null;
  aprobador?: {
    nombreCompleto?: string | null;
  } | null;
  usuarioBeneficiado?: {
    nombreCompleto?: string | null;
  } | null;
  presupuestos?: Array<{
    poa?: {
      codigoPoa?: string | null;
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
  }> | null;
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

import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ReportsService {
  constructor() {}

  async generateSolicitudPdf(solicitud: SolicitudReportData): Promise<Buffer> {
    // 1. Cargar el módulo
    /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    const PdfPrinterLib = require('pdfmake/js/printer');
    const PdfPrinter = PdfPrinterLib.default || PdfPrinterLib;

    const fonts = {
      Roboto: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };

    const printer = new PdfPrinter(fonts);

    const docDefinition: TDocumentDefinitions = {
      content: [
        this.buildHeader(solicitud),
        this.buildDatosGenerales(solicitud),
        // Se ha elminado la seccion ITINERARIO
        this.buildDetalleEconomico(solicitud),
        this.buildDatosBancarios(),
        this.buildFirmas(solicitud),
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
        tableHeader: {
          fontSize: 10,
          bold: true,
          fillColor: '#4bae32',
          color: '#ffffff',
        },
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

  private formatUTCDate(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getUTCDate().toString().padStart(2, '0')}/${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCFullYear()}`;
  }

  private buildHeader(solicitud: SolicitudReportData): any {
    let logoDef: any = {
      text: 'Conservación Amazónica - ACEAA',
      style: 'orgTitle',
    };

    try {
      const logoPath = path.join(process.cwd(), 'logo.png');
      if (fs.existsSync(logoPath)) {
        const logoBase64 = fs.readFileSync(logoPath).toString('base64');
        logoDef = {
          image: `data:image/png;base64,${logoBase64}`,
          width: 150,
        };
      }
    } catch (error) {
      console.warn('No se pudo cargar el logo:', error);
    }

    return [
      {
        columns: [
          logoDef,
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
    ];
  }

  private buildDatosGenerales(solicitud: SolicitudReportData): any {
    // Helper para deduplicar arrays
    const uniqueJoin = (arr: (string | null | undefined)[]) =>
      [...new Set(arr.filter(Boolean))].join(' | ') || 'N/A';

    const codigosPoa = uniqueJoin(
      solicitud.presupuestos?.map((p) => p.poa?.codigoPoa) || [],
    );
    const proyectos = uniqueJoin(
      solicitud.presupuestos?.map((p) => p.poa?.estructura?.proyecto?.nombre) ||
        [],
    );
    const actividadesPoa = uniqueJoin(
      solicitud.presupuestos?.map(
        (p) => p.poa?.actividad?.detalleDescripcion,
      ) || [],
    );
    const codigosActividad = uniqueJoin(
      solicitud.presupuestos?.map(
        (p) => p.poa?.codigoPresupuestario?.codigoCompleto,
      ) || [],
    );

    return [
      { text: 'DATOS GENERALES', style: 'sectionHeader' },
      {
        table: {
          widths: ['25%', '75%'],
          body: [
            ['A:', 'MARCOS FERNANDO TERÁN VALENZUELA - Director Ejecutivo'],
            [
              'Vía:',
              `${solicitud.aprobador?.nombreCompleto || 'N/A'} - Director del Proyecto`,
            ],
            [
              'Desembolso a:',
              solicitud.usuarioBeneficiado?.nombreCompleto ||
                solicitud.usuarioEmisor?.nombreCompleto ||
                'N/A',
            ],
            ['Código POA:', codigosPoa],
            ['Proyecto:', proyectos],
            ['Actividad POA:', actividadesPoa],
            ['Código Actividad:', codigosActividad],
            ['Lugar del Viaje:', solicitud.lugarViaje || 'N/A'],
            ['Motivo del Viaje:', solicitud.motivoViaje || 'N/A'],
            [
              'Fechas:',
              `Del ${this.formatUTCDate(solicitud.fechaInicio)} al ${this.formatUTCDate(solicitud.fechaFin)}`,
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 20],
      },
    ];
  }

  private buildDetalleEconomico(solicitud: SolicitudReportData): any {
    return [
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
          ],
        },
        margin: [0, 0, 0, 20],
      },
    ];
  }

  private buildDatosBancarios(): any {
    return [
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: 'DATOS BANCARIOS (Llenar solo si aplica)',
                fillColor: '#eeeeee',
                bold: true,
              },
            ],
            [
              {
                text: [
                  'Cuenta Bancaria:\n\n',
                  'Nombre: ______________________   N° Cuenta: ______________________   Banco: ______________________\n\n',
                  'N° Transferencia: ______________________\n\n',
                  'Fecha de emisión: ______________________',
                ],
                margin: [0, 10, 0, 10],
              },
            ],
          ],
        },
        margin: [0, 0, 0, 40],
      },
    ];
  }

  private buildFirmas(solicitud: SolicitudReportData): any {
    return [
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
                    x2: 140,
                    y2: 0,
                    lineWidth: 1,
                  },
                ],
              },
              {
                text: 'Solicitado por:',
                alignment: 'center',
                fontSize: 9,
                margin: [0, 5, 0, 0],
                bold: true,
              },
              {
                text: solicitud.usuarioEmisor?.nombreCompleto || '',
                alignment: 'center',
                fontSize: 8,
              },
              {
                text: solicitud.usuarioEmisor?.cargo || 'Cargo no definido',
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
                    x2: 140,
                    y2: 0,
                    lineWidth: 1,
                  },
                ],
              },
              {
                text: 'Revisado por:',
                alignment: 'center',
                fontSize: 9,
                margin: [0, 5, 0, 0],
                bold: true,
              },
              {
                text:
                  solicitud.aprobador?.nombreCompleto || '__________________',
                alignment: 'center',
                fontSize: 8,
              },
              {
                text: 'Director del Proyecto',
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
                    x2: 140,
                    y2: 0,
                    lineWidth: 1,
                  },
                ],
              },
              {
                text: 'Aprobado por:',
                alignment: 'center',
                fontSize: 9,
                margin: [0, 5, 0, 0],
                bold: true,
              },
              {
                text: 'MARCOS FERNANDO TERÁN VALENZUELA',
                alignment: 'center',
                fontSize: 8,
              },
              {
                text: 'Director Ejecutivo',
                alignment: 'center',
                fontSize: 8,
                italics: true,
              },
            ],
            alignment: 'center',
          },
        ],
      },
    ];
  }
}
