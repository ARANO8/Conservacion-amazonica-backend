import { construirAnexo1, Anexo1Fuente } from './anexo1.builder';
import { MIN_FILAS_ANEXO1 } from './planes-viaje.constants';

describe('construirAnexo1', () => {
  const fuente: Anexo1Fuente = {
    codigoPlan: 'PV-2026-004',
    cargo: 'Técnico de campo',
    lugaresViaje: 'Riberalta - Guayaramerín',
    objetivoViaje: 'Socializar las propuestas',
    lugarEmision: 'La Paz',
    fechaEmision: new Date('2026-10-28T00:00:00.000Z'),
    usuario: { nombreCompleto: 'Ana Rojas' },
    directorPrograma: { nombreCompleto: 'Luis Vaca' },
    actividades: [
      {
        fechaInicio: new Date('2026-11-03T00:00:00.000Z'),
        fechaFin: new Date('2026-11-05T00:00:00.000Z'),
        lugarSalida: 'La Paz',
        lugarLlegada: 'Riberalta',
        actividadProgramada: 'Taller comunal',
        cantidadPersonasTerceros: 3,
        participantesInstitucionales: [
          { nombreCompleto: 'Ana Rojas' },
          { nombreCompleto: 'Pedro Soliz' },
        ],
      },
      {
        fechaInicio: new Date('2026-11-06T00:00:00.000Z'),
        fechaFin: new Date('2026-11-06T00:00:00.000Z'),
        lugarSalida: null,
        lugarLlegada: null,
        actividadProgramada: 'Retorno',
        cantidadPersonasTerceros: 0,
        participantesInstitucionales: [{ nombreCompleto: 'Ana Rojas' }],
      },
    ],
  };

  it('arma el cronograma con rango de fechas, lugares y participantes', () => {
    const anexo = construirAnexo1(fuente);

    expect(anexo.filas[0]).toEqual({
      fechas: '03/11/2026 al 05/11/2026',
      salida: 'La Paz',
      llegada: 'Riberalta',
      actividad: 'Taller comunal',
      deAceaa: ['Ana Rojas', 'Pedro Soliz'],
      terceros: '3',
    });
  });

  it('muestra un solo día sin rango y deja en blanco lo que no hay', () => {
    const fila = construirAnexo1(fuente).filas[1];

    expect(fila.fechas).toBe('06/11/2026');
    expect(fila.salida).toBe('');
    expect(fila.terceros).toBe('');
  });

  it('rellena hasta las filas mínimas del formato impreso', () => {
    const anexo = construirAnexo1(fuente);

    expect(anexo.filas).toHaveLength(MIN_FILAS_ANEXO1);
    expect(anexo.filas[MIN_FILAS_ANEXO1 - 1].actividad).toBe('');
  });

  it('firma con el responsable y el Director de Programa', () => {
    const anexo = construirAnexo1(fuente);

    expect(anexo.responsable).toBe('Ana Rojas');
    expect(anexo.directorPrograma).toBe('Luis Vaca');
    expect(anexo.fechaEmision).toBe('28/10/2026');
  });
});
