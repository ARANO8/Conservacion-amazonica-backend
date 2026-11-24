import { Moneda, Prisma } from '@prisma/client';
import { calcularMontosViaticos } from './solicitudes.helper';
import { tarifaEnBolivianos } from '../common/constants/financial.constants';
import { desglosarRetenciones } from '../rendiciones/rendiciones.helper';

// Reglas del Instructivo de Viaje y Viáticos del 03/08/2026
describe('Tarifas de viáticos (instructivo 03/08/2026)', () => {
  describe('calcularMontosViaticos', () => {
    it('institucional: bruto = líquido / 0,87, todo RC-IVA', () => {
      const r = calcularMontosViaticos(new Prisma.Decimal(250), 1, 1);
      expect(r.subtotalNeto.toNumber()).toBe(250);
      expect(r.montoPresupuestado.toNumber()).toBe(287.36);
      expect(r.iva.toNumber()).toBe(37.36);
      expect(r.it.toNumber()).toBe(0);
    });

    it('terceros retiene igual que institucional (13%, sin IT)', () => {
      const r = calcularMontosViaticos(
        new Prisma.Decimal(200),
        2,
        3,
        'TERCEROS',
      );
      expect(r.subtotalNeto.toNumber()).toBe(1200);
      expect(r.montoPresupuestado.toNumber()).toBe(1379.31);
      expect(r.iva.toNumber()).toBe(179.31);
      expect(r.it.toNumber()).toBe(0);
    });
  });

  describe('tarifaEnBolivianos', () => {
    it('convierte USD al tipo de cambio oficial', () => {
      expect(tarifaEnBolivianos(90, Moneda.USD).toNumber()).toBe(626.4);
      expect(tarifaEnBolivianos(130, Moneda.USD).toNumber()).toBe(904.8);
    });

    it('deja los Bs como están', () => {
      expect(tarifaEnBolivianos(500, Moneda.BOB).toNumber()).toBe(500);
    });
  });

  describe('rendición: planilla de viáticos de terceros (PVT)', () => {
    it('todo el impuesto es RC-IVA, sin IT', () => {
      const r = desglosarRetenciones(179.31, 'PVT');
      expect(r.rcIva.toNumber()).toBe(179.31);
      expect(r.it.toNumber()).toBe(0);
    });

    it('la planilla de alimentación (PAT) sigue en 13% + 3%', () => {
      const r = desglosarRetenciones(160, 'PAT');
      expect(r.rcIva.toNumber()).toBe(130);
      expect(r.it.toNumber()).toBe(30);
    });
  });
});
