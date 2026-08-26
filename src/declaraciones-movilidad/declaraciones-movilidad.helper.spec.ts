import {
  calcularMonto,
  resumirDeclaracion,
} from './declaraciones-movilidad.helper';

describe('declaraciones-movilidad.helper', () => {
  describe('calcularMonto', () => {
    // Caso real de la planilla: F16=500 y F17=200 con el divisor 0.845.
    it('aplica el grossing-up de la columna F del ANEXO 6', () => {
      expect(calcularMonto(500).toFixed(2)).toBe('591.72');
      expect(calcularMonto(200).toFixed(2)).toBe('236.69');
    });

    it('devuelve cero cuando la fila está vacía', () => {
      expect(calcularMonto(0).toFixed(2)).toBe('0.00');
    });
  });

  describe('resumirDeclaracion', () => {
    it('reproduce el pie del ANEXO 6 con la retención correcta de 15.5%', () => {
      const montos = [calcularMonto(500), calcularMonto(200)];
      const resumen = resumirDeclaracion(montos);

      expect(resumen.totalBruto.toFixed(2)).toBe('828.41');
      expect(resumen.retencion.toFixed(2)).toBe('128.40');
      // El líquido debe volver a lo que el declarante gastó de su bolsillo.
      expect(resumen.totalLiquido.toFixed(2)).toBe('700.01');
    });

    it('devuelve ceros sin filas', () => {
      const resumen = resumirDeclaracion([]);

      expect(resumen.totalBruto.toFixed(2)).toBe('0.00');
      expect(resumen.retencion.toFixed(2)).toBe('0.00');
      expect(resumen.totalLiquido.toFixed(2)).toBe('0.00');
    });
  });
});
