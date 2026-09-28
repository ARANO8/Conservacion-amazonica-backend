import { Prisma } from '@prisma/client';
import {
  calcularFila,
  descripcionFila,
  escalaPredominante,
  importeDiaBruto,
  precargarFilasPorPersona,
  totalizarHoja,
} from './liquidacion.helper';

describe('liquidacion.helper', () => {
  it('parte del líquido: 2 días de ciudad a 250 pagan exactamente 500', () => {
    const fila = calcularFila(250, 2, 100);

    expect(fila.totalLiquido.toString()).toBe('500');
    expect(fila.totalBruto.toString()).toBe('574.71');
  });

  it('el medio viático paga la mitad y admite medios días', () => {
    const fila = calcularFila(250, 1.5, 50);

    expect(fila.totalLiquido.toString()).toBe('187.5');
  });

  it('el importe por día se imprime en bruto', () => {
    expect(importeDiaBruto(250, 100).toString()).toBe('287.36');
    expect(importeDiaBruto(250, 50).toString()).toBe('143.68');
  });

  it('el bruto de la hoja suma las filas y la retención es la diferencia', () => {
    const totales = totalizarHoja([
      calcularFila(250, 2, 100),
      calcularFila(162, 1, 100),
    ]);

    expect(totales.totalLiquido.toString()).toBe('662');
    expect(totales.totalBruto.toString()).toBe('760.92');
    expect(totales.rcIva.toString()).toBe('98.92');
  });

  it('la escala es el tipo de destino con más días', () => {
    expect(
      escalaPredominante([
        { nombreConcepto: 'CIUDADES_PRINCIPALES', dias: 1 },
        { nombreConcepto: 'COMUNIDADES', dias: 3 },
      ]),
    ).toBe('Comunidad');
  });

  it('describe la fila como el formulario', () => {
    expect(descripcionFila('PUEBLOS', 50)).toBe('Viático Pueblo 50%');
  });

  describe('precargarFilasPorPersona', () => {
    const viatico = (overrides: Record<string, unknown> = {}) => ({
      tipoDestino: 'INSTITUCIONAL',
      dias: new Prisma.Decimal(2),
      conceptoId: 1,
      solicitudPresupuestoId: 10,
      concepto: { nombre: 'CIUDADES_PRINCIPALES' },
      planificaciones: [
        { participantesInstitucionales: [{ id: 3 }, { id: 5 }] },
      ],
      ...overrides,
    });

    it('da a cada participante los días del viático', () => {
      const filas = precargarFilasPorPersona([viatico()]);

      expect([...filas.keys()]).toEqual([3, 5]);
      expect(filas.get(3)).toEqual([
        {
          conceptoId: 1,
          nombreConcepto: 'CIUDADES_PRINCIPALES',
          porcentaje: 100,
          dias: 2,
          solicitudPresupuestoId: 10,
        },
      ]);
    });

    it('suma la misma tarifa y partida, e ignora los viáticos de terceros', () => {
      const filas = precargarFilasPorPersona([
        viatico(),
        viatico({ dias: new Prisma.Decimal(1.5) }),
        viatico({ tipoDestino: 'TERCEROS' }),
      ]);

      expect(filas.get(3)?.[0].dias).toBe(3.5);
      expect(filas.get(3)).toHaveLength(1);
    });
  });
});
