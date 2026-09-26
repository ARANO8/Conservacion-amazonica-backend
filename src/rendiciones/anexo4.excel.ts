import * as ExcelJS from 'exceljs';
import type { Anexo4 } from './anexo4.builder';

/**
 * ANEXO 4 en Excel, con la misma grilla que la hoja "REND. FONDOS BS" de los
 * formularios de ACEAA (columnas A-O, bloque de retenciones desde la J). Los
 * saldos, totales y la liquidación van como fórmulas para que Contabilidad
 * pueda ajustar un importe y el resto se recalcule.
 */

const FUENTE = 'Bookman Old Style';
const GRIS = 'FFBFBFBF';
const GRIS_CLARO = 'FFD8D8D8';
const CELESTE = 'FFCCFFFF';
const HUMO = 'FFF2F2F2';
const FORMATO_BS = '#,##0.00;-#,##0.00;"-"';

const ANCHOS: Record<string, number> = {
  A: 21.3,
  B: 18.4,
  C: 15,
  D: 13.4,
  E: 32,
  F: 14.4,
  G: 14.7,
  H: 14.6,
  I: 3.3,
  J: 14.6,
  K: 10,
  L: 8.3,
  M: 9.4,
  N: 14.4,
  O: 14.7,
};

const BORDE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

function relleno(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

export async function generarExcelAnexo4(anexo: Anexo4): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'AMZ desk';
  const hoja = libro.addWorksheet('REND. FONDOS BS', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  Object.entries(ANCHOS).forEach(([col, ancho]) => {
    hoja.getColumn(col).width = ancho;
  });

  const celda = (ref: string) => hoja.getCell(ref);
  const escribir = (
    ref: string,
    valor: ExcelJS.CellValue,
    opciones: {
      bold?: boolean;
      fill?: string;
      borde?: boolean;
      alinear?: ExcelJS.Alignment['horizontal'];
      numero?: boolean;
    } = {},
  ) => {
    const c = celda(ref);
    c.value = valor;
    c.font = { name: FUENTE, size: 9, bold: opciones.bold };
    if (opciones.fill) c.fill = relleno(opciones.fill);
    if (opciones.borde) c.border = BORDE;
    if (opciones.numero) c.numFmt = FORMATO_BS;
    c.alignment = {
      vertical: 'middle',
      horizontal: opciones.alinear ?? (opciones.numero ? 'right' : 'left'),
      wrapText: true,
    };
    return c;
  };
  const combinar = (rango: string) => hoja.mergeCells(rango);
  const formula = (f: string, resultado: number | string | null) => ({
    formula: f,
    result: resultado ?? undefined,
  });

  // --- Títulos ---
  combinar('G1:H1');
  escribir('G1', 'ANEXO 4', { bold: true, alinear: 'right' });
  combinar('A2:H2');
  escribir('A2', 'RENDICIÓN DE FONDOS EN AVANCE', {
    bold: true,
    fill: GRIS,
    alinear: 'center',
  });
  combinar('J2:O2');
  escribir('J2', 'RETENCIONES IMPOSITIVAS', {
    bold: true,
    fill: GRIS,
    alinear: 'center',
  });
  combinar('A3:H3');
  escribir('A3', '(Expresado en Bolivianos)', {
    bold: true,
    fill: GRIS,
    alinear: 'center',
  });
  combinar('J3:O3');
  escribir('J3', '(Expresado en Bolivianos)', {
    bold: true,
    fill: GRIS,
    alinear: 'center',
  });

  // --- Datos generales ---
  const dato = (
    fila: number,
    etiqueta: string,
    desde: string,
    valor: string,
  ) => {
    escribir(`A${fila}`, etiqueta, { bold: true });
    combinar(`${desde}${fila}:H${fila}`);
    escribir(`${desde}${fila}`, valor);
  };
  dato(5, 'A:', 'B', anexo.a);
  dato(6, 'DE:', 'B', anexo.de);
  dato(7, 'PROYECTO:', 'B', anexo.proyecto);
  dato(8, 'CÓDIGO DE ACTIVIDAD', 'D', anexo.codigoActividad);
  dato(9, 'CHEQUE A NOMBRE DE:', 'D', anexo.chequeANombreDe);
  escribir('A10', 'BANCO Y CUENTA BANCARIA N°', { bold: true });
  combinar('E10:F10');
  escribir('E10', anexo.bancoCuenta);
  escribir('G10', 'CHEQUE N°', { bold: true });
  escribir('H10', anexo.chequeNro);
  escribir('A11', 'FECHA ENTREGA DE FONDOS', { bold: true });
  combinar('E11:F11');
  escribir('E11', anexo.fechaEntrega);
  escribir('A12', 'FECHA DE RENDICIÓN:', { bold: true });
  combinar('E12:F12');
  escribir('E12', anexo.fechaRendicion);

  // --- Encabezado de la tabla (filas 14-15) ---
  const cabecera = (ref: string, texto: string | number, numero = false) =>
    escribir(ref, texto, {
      bold: true,
      fill: GRIS,
      borde: true,
      alinear: 'center',
      numero,
    });
  (
    [
      ['A', 'FECHA'],
      ['B', 'N°\nDOCTO.'],
      ['C', 'TIPO\nDOCTO.'],
      ['D', 'PARTIDA'],
      ['E', 'DESCRIPCIÓN'],
      ['J', 'TOTAL'],
      ['N', 'TOTAL IMPUESTOS'],
      ['O', 'NETO'],
    ] as const
  ).forEach(([col, texto]) => {
    combinar(`${col}14:${col}15`);
    cabecera(`${col}14`, texto);
  });
  combinar('F14:H14');
  cabecera('F14', 'MONTO BS');
  cabecera('F15', 'INGRESOS');
  cabecera('G15', 'EGRESOS');
  cabecera('H15', 'SALDO');
  cabecera('K14', 'RC-IVA');
  cabecera('L14', 'IUE');
  cabecera('M14', 'IT');
  ['K15', 'L15', 'M15'].forEach((ref, i) => {
    cabecera(ref, [0.13, 0.05, 0.03][i]);
    celda(ref).numFmt = '0%';
  });

  // --- Movimientos ---
  const primera = 16;
  anexo.filas.forEach((f, i) => {
    const r = primera + i;
    const texto = (col: string, valor: string, bold = false) =>
      escribir(`${col}${r}`, valor, {
        borde: true,
        bold,
        alinear: col === 'E' ? 'left' : 'center',
      });
    const importe = (col: string, valor: ExcelJS.CellValue) =>
      escribir(`${col}${r}`, valor, { borde: true, numero: true });

    texto('A', f.fecha);
    texto('B', f.nroDocto);
    texto('C', f.tipoDocto);
    texto('D', f.partida);
    texto('E', f.descripcion, f.esFondo);
    importe('F', f.ingreso);
    importe('G', f.egreso);
    // Saldo corrido: el anterior más ingresos menos egresos
    importe(
      'H',
      i === 0
        ? formula(`F${r}-G${r}`, f.saldo)
        : formula(`H${r - 1}+F${r}-G${r}`, f.saldo),
    );
    importe('J', f.total);
    importe('K', f.rcIva);
    importe('L', f.iue);
    importe('M', f.it);
    importe(
      'N',
      f.esFondo ? null : formula(`SUM(K${r}:M${r})`, f.totalImpuestos),
    );
    importe('O', f.esFondo ? null : formula(`J${r}-N${r}`, f.neto));
  });
  const ultima = primera + anexo.filas.length - 1;

  // --- Totales ---
  const t = ultima + 1;
  combinar(`A${t}:E${t}`);
  escribir(`A${t}`, 'TOTAL', {
    bold: true,
    fill: GRIS,
    borde: true,
    alinear: 'center',
  });
  const total = (col: string, f: string, resultado: number) =>
    escribir(`${col}${t}`, formula(f, resultado), {
      bold: true,
      fill: GRIS,
      borde: true,
      numero: true,
    });
  const rango = (col: string) => `${col}${primera}:${col}${ultima}`;
  total('F', `SUM(${rango('F')})`, anexo.totales.ingresos);
  total('G', `SUM(${rango('G')})`, anexo.totales.egresos);
  total('H', `F${t}-G${t}`, anexo.totales.saldo);
  total('J', `SUM(${rango('J')})`, anexo.totales.total);
  total('K', `SUM(${rango('K')})`, anexo.totales.rcIva);
  total('L', `SUM(${rango('L')})`, anexo.totales.iue);
  total('M', `SUM(${rango('M')})`, anexo.totales.it);
  total('N', `SUM(${rango('N')})`, anexo.totales.totalImpuestos);
  total('O', `SUM(${rango('O')})`, anexo.totales.neto);

  // --- Observaciones ---
  const obs = t + 2;
  escribir(`A${obs}`, 'Observaciones:', { bold: true });
  combinar(`B${obs}:O${obs}`);
  escribir(`B${obs}`, anexo.observaciones);

  // --- Liquidación y documentos ---
  const liq = obs + 2;
  const etiquetaLiq = (ref: string, texto: string) =>
    escribir(ref, texto, { bold: true, fill: CELESTE, borde: true });
  const valorLiq = (rangoCeldas: string, valor: ExcelJS.CellValue) => {
    combinar(rangoCeldas);
    escribir(rangoCeldas.split(':')[0], valor, {
      fill: HUMO,
      borde: true,
      numero: true,
    });
  };
  const { liquidacion, documentos } = anexo;
  etiquetaLiq(`A${liq}`, 'Importe recibido:');
  valorLiq(`D${liq}:E${liq}`, formula(`F${t}`, liquidacion.importeRecibido));
  etiquetaLiq(`A${liq + 1}`, 'Total gastado:');
  valorLiq(
    `D${liq + 1}:E${liq + 1}`,
    formula(`G${t}`, liquidacion.totalGastado),
  );
  etiquetaLiq(`A${liq + 2}`, 'Saldo:');
  valorLiq(
    `D${liq + 2}:E${liq + 2}`,
    formula(`D${liq}-D${liq + 1}`, liquidacion.saldo),
  );
  etiquetaLiq(`G${liq + 1}`, 'A favor del empleado:');
  escribir(
    `H${liq + 1}`,
    formula(
      `IF(D${liq + 2}<0,-D${liq + 2},"")`,
      liquidacion.aFavorEmpleado ?? '',
    ),
    { fill: HUMO, borde: true, numero: true },
  );
  etiquetaLiq(`G${liq + 2}`, 'A favor del Proyecto:');
  escribir(
    `H${liq + 2}`,
    formula(
      `IF(D${liq + 2}>0,D${liq + 2},"")`,
      liquidacion.aFavorProyecto ?? '',
    ),
    { fill: HUMO, borde: true, numero: true },
  );

  const doc = (
    fila: number,
    a: string,
    b: ExcelJS.CellValue,
    c: ExcelJS.CellValue,
    cab = false,
  ) => {
    combinar(`J${fila}:K${fila}`);
    combinar(`L${fila}:M${fila}`);
    combinar(`N${fila}:O${fila}`);
    const estilo = { borde: true, bold: cab, fill: cab ? GRIS : undefined };
    escribir(`J${fila}`, a, { ...estilo, alinear: cab ? 'center' : 'left' });
    escribir(`L${fila}`, b, { ...estilo, alinear: 'center' });
    escribir(`N${fila}`, c, {
      ...estilo,
      numero: !cab || typeof c !== 'string',
    });
  };
  doc(liq, 'Documentos', 'Cantidad', 'Monto Bs', true);
  doc(
    liq + 1,
    'Facturas',
    documentos.facturasCantidad,
    documentos.facturasMonto,
  );
  doc(
    liq + 2,
    'Recibos y otros',
    documentos.recibosCantidad,
    documentos.recibosMonto,
  );
  doc(
    liq + 3,
    'TOTAL',
    formula(`SUM(L${liq + 1}:L${liq + 2})`, documentos.totalCantidad),
    formula(`SUM(N${liq + 1}:N${liq + 2})`, documentos.totalMonto),
    true,
  );

  // --- Resumen contable ---
  const rc = liq + 6;
  combinar(`A${rc}:D${rc}`);
  escribir(`A${rc}`, 'RESUMEN CONTABLE', {
    bold: true,
    fill: GRIS_CLARO,
    borde: true,
  });
  combinar(`A${rc + 1}:B${rc + 1}`);
  escribir(`A${rc + 1}`, 'NOMBRE PARTIDA', {
    bold: true,
    fill: GRIS_CLARO,
    borde: true,
    alinear: 'center',
  });
  escribir(`C${rc + 1}`, 'CÓDIGO PARTIDA', {
    bold: true,
    fill: GRIS_CLARO,
    borde: true,
    alinear: 'center',
  });
  escribir(`D${rc + 1}`, 'MONTO', {
    bold: true,
    fill: GRIS_CLARO,
    borde: true,
    alinear: 'center',
  });
  const partidas = anexo.resumenContable.length
    ? anexo.resumenContable
    : [{ nombre: '', codigo: '', monto: 0 }];
  partidas.forEach((p, i) => {
    const r = rc + 2 + i;
    combinar(`A${r}:B${r}`);
    escribir(`A${r}`, p.nombre, { borde: true });
    escribir(`C${r}`, p.codigo, { borde: true, alinear: 'center' });
    escribir(`D${r}`, p.monto, { borde: true, numero: true });
  });
  const rcTotal = rc + 2 + partidas.length;
  combinar(`A${rcTotal}:C${rcTotal}`);
  escribir(`A${rcTotal}`, 'TOTAL', {
    bold: true,
    fill: GRIS_CLARO,
    borde: true,
    alinear: 'center',
  });
  escribir(
    `D${rcTotal}`,
    formula(`SUM(D${rc + 2}:D${rcTotal - 1})`, anexo.resumenContableTotal),
    { bold: true, fill: GRIS_CLARO, borde: true, numero: true },
  );

  // --- Firmas ---
  const fi = rcTotal + 4;
  const firma = (
    desde: string,
    hasta: string,
    etiqueta: string,
    persona: { nombre: string; cargo: string },
  ) => {
    const lineas: [number, string][] = [
      [fi, etiqueta],
      [fi + 1, persona.nombre],
      [fi + 2, persona.cargo.toUpperCase()],
    ];
    lineas.forEach(([fila, texto]) => {
      combinar(`${desde}${fila}:${hasta}${fila}`);
      escribir(`${desde}${fila}`, texto, { alinear: 'center' });
    });
    // Línea de firma sobre "Elaborado / Revisado / Aprobado por"
    celda(`${desde}${fi}`).border = { top: { style: 'thin' } };
  };
  firma('A', 'C', 'Elaborado por:', anexo.firmas.elaboradoPor);
  firma('F', 'H', 'Revisado por:', anexo.firmas.revisadoPor);
  firma('L', 'N', 'Aprobado por:', anexo.firmas.aprobadoPor);

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
