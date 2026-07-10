import {
  numeroALetras as numeroALetrasUtil,
  montoEnLetrasBolivianos as montoEnLetrasBolivianosUtil,
} from '../shared/utils/letras.util';

/**
 * Convierte un número (parte entera) a su representación en letras
 * en español, en mayúsculas. Soporta hasta cientos de millones.
 */
export function numeroALetras(valor: number): string {
  return numeroALetrasUtil(valor);
}

/**
 * Genera la frase legal "SON: <entero en letras> XX/100 BOLIVIANOS".
 */
export function montoEnLetrasBolivianos(valor: number): string {
  // Nota: El utilitario letras.util ya antepone "SON: ", pero para mantener
  // compatibilidad con las plantillas de cotización preexistentes que pueden
  // agregar "SON: " manualmente o requerir el prefijo integrado, mantenemos
  // el comportamiento. letras.util ya devuelve el formato completo.
  const letras = montoEnLetrasBolivianosUtil(valor);
  // Si letras ya empieza con "SON: ", y queremos retornar solo el texto,
  // verificamos que la plantilla cotizacion.hbs no duplique la palabra.
  // Vamos a ver: en cotizacion.hbs se renderiza {{totalEnLetras}} directamente
  // dentro de una celda que dice "SON: ".
  return letras.replace(/^SON:\s+/i, '');
}
