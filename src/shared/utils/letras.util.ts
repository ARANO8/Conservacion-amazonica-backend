const UNIDADES = [
  '',
  'UNO',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISEIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
  'VEINTE',
];

const DECENAS = [
  '',
  '',
  'VEINTI',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];

const CENTENAS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

function convertirGrupo(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  const centena = Math.floor(n / 100);
  const resto = n % 100;
  let texto = CENTENAS[centena] ?? '';

  if (resto <= 20) {
    texto = `${texto} ${UNIDADES[resto]}`;
  } else if (resto < 30) {
    texto = `${texto} VEINTI${UNIDADES[resto - 20]}`;
  } else {
    const decena = Math.floor(resto / 10);
    const unidad = resto % 10;
    texto = `${texto} ${DECENAS[decena]}`;
    if (unidad > 0) {
      texto = `${texto} Y ${UNIDADES[unidad]}`;
    }
  }

  return texto.trim().replace(/\s+/g, ' ');
}

/**
 * Convierte un número (parte entera) a su representación en letras
 * en español, en mayúsculas. Soporta hasta cientos de millones.
 */
export function numeroALetras(valor: number): string {
  const entero = Math.floor(Math.abs(valor));

  if (entero === 0) return 'CERO';

  const millones = Math.floor(entero / 1_000_000);
  const miles = Math.floor((entero % 1_000_000) / 1000);
  const unidades = entero % 1000;

  const partes: string[] = [];

  if (millones > 0) {
    partes.push(
      millones === 1 ? 'UN MILLON' : `${convertirGrupo(millones)} MILLONES`,
    );
  }

  if (miles > 0) {
    partes.push(miles === 1 ? 'MIL' : `${convertirGrupo(miles)} MIL`);
  }

  if (unidades > 0) {
    partes.push(convertirGrupo(unidades));
  }

  return partes.join(' ').trim().replace(/\s+/g, ' ');
}

/**
 * Genera la frase legal "SON: <entero en letras> XX/100 BOLIVIANOS".
 */
export function montoEnLetrasBolivianos(valor: number): string {
  const seguro = Number.isFinite(valor) ? valor : 0;
  const entero = Math.floor(seguro);
  const centavos = Math.round((seguro - entero) * 100);
  const centavosTexto = centavos.toString().padStart(2, '0');

  return `SON: ${numeroALetras(entero)} ${centavosTexto}/100 BOLIVIANOS`;
}
