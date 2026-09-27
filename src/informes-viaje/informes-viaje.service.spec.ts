import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  EstadoInformeViaje,
  EstadoSolicitud,
  Rol,
  TipoSolicitud,
} from '@prisma/client';
import {
  InformesViajeService,
  precargarInforme,
} from './informes-viaje.service';
import { construirAnexo7, fechaEnPalabras } from './anexo7.builder';
import { MIN_FILAS_ANEXO7, NOTA_ANEXO7 } from './informes-viaje.constants';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

const AUTOR = 42;
const DIRECTOR = 7;

/** Primer argumento de la primera llamada, tipado para las aserciones. */
function primerArgumento(mock: jest.Mock): unknown {
  return (mock.mock.calls as unknown[][])[0][0];
}

function buildSolicitud(overrides: Record<string, unknown> = {}) {
  return {
    id: 30,
    codigoSolicitud: 'SOL-2026-030',
    tipo: TipoSolicitud.VIAJE,
    estado: EstadoSolicitud.DESEMBOLSADO,
    usuarioEmisorId: AUTOR,
    directorProgramaId: DIRECTOR,
    motivoViaje: 'Motivo de la solicitud',
    lugarViaje: 'Lugar de la solicitud',
    fechaInicio: new Date('2026-11-03'),
    fechaFin: new Date('2026-11-05'),
    directorPrograma: {
      id: DIRECTOR,
      nombreCompleto: 'Luis Vaca',
      rol: Rol.USUARIO,
    },
    planViaje: {
      objetivoViaje: 'Socializar propuestas',
      lugaresViaje: 'Riberalta',
      actividades: [
        {
          fechaInicio: new Date('2026-11-03'),
          lugarLlegada: 'Riberalta',
          actividadProgramada: 'Taller comunal',
        },
      ],
    },
    informeViaje: null,
    ...overrides,
  };
}

function buildInforme(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    codigoInforme: 'IV-2026-005',
    usuarioId: AUTOR,
    directorProgramaId: DIRECTOR,
    estado: EstadoInformeViaje.BORRADOR,
    usuario: { nombreCompleto: 'Ana Rojas' },
    actividades: [{ id: 1 }],
    solicitud: { id: 30, aprobadorId: null, deletedAt: null },
    ...overrides,
  };
}

describe('precargarInforme', () => {
  it('toma motivo, lugar y actividades del plan de viaje', () => {
    const precarga = precargarInforme(buildSolicitud() as never);

    expect(precarga).toMatchObject({
      motivoViaje: 'Socializar propuestas',
      lugarViaje: 'Riberalta',
      directorProgramaId: DIRECTOR,
      actividades: [
        {
          lugar: 'Riberalta',
          personaInstitucion: '',
          actividadesRealizadas: 'Taller comunal',
        },
      ],
    });
  });

  it('no propone como revisor a un Tesorero ni al propio emisor', () => {
    const tesorero = precargarInforme(
      buildSolicitud({
        directorPrograma: { id: 2, nombreCompleto: 'X', rol: Rol.TESORERO },
      }) as never,
    );
    const propio = precargarInforme(
      buildSolicitud({
        directorPrograma: { id: AUTOR, nombreCompleto: 'X', rol: Rol.USUARIO },
      }) as never,
    );

    expect(tesorero.directorProgramaId).toBeNull();
    expect(propio.directorProgramaId).toBeNull();
  });

  it('sin plan, usa los datos de la solicitud y deja la tabla vacía', () => {
    const precarga = precargarInforme(
      buildSolicitud({ planViaje: null }) as never,
    );

    expect(precarga.motivoViaje).toBe('Motivo de la solicitud');
    expect(precarga.lugarViaje).toBe('Lugar de la solicitud');
    expect(precarga.actividades).toEqual([]);
  });
});

describe('construirAnexo7', () => {
  const anexo = construirAnexo7(
    {
      codigoInforme: 'IV-2026-005',
      motivoViaje: 'Socializar propuestas',
      lugarViaje: 'Riberalta',
      fechaInicio: new Date('2026-11-03T00:00:00.000Z'),
      fechaFin: new Date('2026-11-05T00:00:00.000Z'),
      lugarEmision: 'La Paz',
      fechaEmision: new Date('2026-11-10T00:00:00.000Z'),
      usuario: { nombreCompleto: 'Ana Rojas' },
      directorPrograma: { nombreCompleto: 'Luis Vaca' },
      actividades: [
        {
          fecha: new Date('2026-11-03T00:00:00.000Z'),
          lugar: 'Riberalta',
          personaInstitucion: 'Alcaldía',
          actividadesRealizadas: 'Reunión',
        },
      ],
    },
    'Marcos F. Terán Valenzuela',
  );

  it('arma encabezado, rango y firmas', () => {
    expect(anexo).toMatchObject({
      destinatario: 'Marcos F. Terán Valenzuela',
      de: 'Ana Rojas',
      fechaDel: '03/11/2026',
      fechaAl: '05/11/2026',
      fechaEmision: '10 de noviembre de 2026',
      preparadoPor: 'Ana Rojas',
      revisadoPor: 'Luis Vaca',
      notaPie: NOTA_ANEXO7,
    });
  });

  it('rellena la tabla hasta las filas del formato', () => {
    expect(anexo.filas).toHaveLength(MIN_FILAS_ANEXO7);
    expect(anexo.filas[0].personaInstitucion).toBe('Alcaldía');
    expect(anexo.filas[MIN_FILAS_ANEXO7 - 1].lugar).toBe('');
  });

  it('escribe la fecha de emisión en palabras, en UTC', () => {
    expect(fechaEnPalabras(new Date('2026-01-01T00:00:00.000Z'))).toBe(
      '1 de enero de 2026',
    );
  });
});

describe('InformesViajeService', () => {
  let service: InformesViajeService;
  let prismaMock: {
    solicitud: { findFirst: jest.Mock };
    informeViaje: { findFirst: jest.Mock; update: jest.Mock };
    historialAprobacion: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let notificaciones: { crearNotificacion: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      solicitud: { findFirst: jest.fn() },
      informeViaje: { findFirst: jest.fn(), update: jest.fn() },
      historialAprobacion: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prismaMock)),
    };
    notificaciones = { crearNotificacion: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InformesViajeService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PdfService, useValue: {} },
        { provide: NotificacionesService, useValue: notificaciones },
      ],
    }).compile();

    service = module.get(InformesViajeService);
  });

  const dto = {
    solicitudId: 30,
    motivoViaje: 'Socializar',
    lugarViaje: 'Riberalta',
    fechaEmision: new Date('2026-11-10'),
    actividades: [
      {
        fecha: new Date('2026-11-03'),
        lugar: 'Riberalta',
        personaInstitucion: 'Alcaldía',
        actividadesRealizadas: 'Reunión',
      },
    ],
  };

  describe('la solicitud del informe', () => {
    it.each([
      ['de otro usuario', { usuarioEmisorId: 999 }, ForbiddenException],
      [
        'sin desembolsar',
        { estado: EstadoSolicitud.PENDIENTE },
        BadRequestException,
      ],
      [
        'de compras',
        { tipo: TipoSolicitud.COMPRA_SERVICIO },
        BadRequestException,
      ],
      [
        'que ya tiene informe',
        { informeViaje: { id: 1, deletedAt: null } },
        BadRequestException,
      ],
    ])('rechaza una solicitud %s', async (_caso, overrides, error) => {
      prismaMock.solicitud.findFirst.mockResolvedValue(
        buildSolicitud(overrides),
      );

      await expect(service.create(dto, AUTOR)).rejects.toBeInstanceOf(error);
    });
  });

  describe('ciclo', () => {
    const conInforme = (overrides: Record<string, unknown> = {}) =>
      prismaMock.informeViaje.findFirst.mockResolvedValue(
        buildInforme(overrides),
      );

    it('enviar pasa a ENVIADO y notifica al revisor', async () => {
      conInforme();

      await service.enviar(5, AUTOR);

      expect(primerArgumento(prismaMock.informeViaje.update)).toMatchObject({
        data: { estado: EstadoInformeViaje.ENVIADO },
      });
      expect(primerArgumento(notificaciones.crearNotificacion)).toMatchObject({
        tipo: 'INFORME_VIAJE_PENDIENTE',
        usuarioId: DIRECTOR,
      });
    });

    it('no se envía sin revisor', async () => {
      conInforme({ directorProgramaId: null });

      await expect(service.enviar(5, AUTOR)).rejects.toThrow(
        /Director de Programa/,
      );
    });

    it('solo el revisor asignado lo revisa', async () => {
      conInforme({ estado: EstadoInformeViaje.ENVIADO });

      await expect(
        service.revisar(5, { id: 999, rol: Rol.EJECUTIVO }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('el revisor lo da por revisado y avisa al autor', async () => {
      conInforme({ estado: EstadoInformeViaje.ENVIADO });

      await service.revisar(5, { id: DIRECTOR, rol: Rol.USUARIO });

      expect(primerArgumento(prismaMock.informeViaje.update)).toMatchObject({
        data: { estado: EstadoInformeViaje.REVISADO },
      });
      expect(primerArgumento(notificaciones.crearNotificacion)).toMatchObject({
        tipo: 'INFORME_VIAJE_REVISADO',
        usuarioId: AUTOR,
      });
    });

    it('observar guarda el motivo', async () => {
      conInforme({ estado: EstadoInformeViaje.ENVIADO });

      await service.observar(
        5,
        { motivo: '  Falta la reunión  ' },
        { id: DIRECTOR, rol: Rol.USUARIO },
      );

      expect(primerArgumento(prismaMock.informeViaje.update)).toMatchObject({
        data: {
          estado: EstadoInformeViaje.OBSERVADO,
          observacion: 'Falta la reunión',
        },
      });
    });

    it('un informe enviado no se edita', async () => {
      conInforme({ estado: EstadoInformeViaje.ENVIADO });

      await expect(
        service.update(5, { motivoViaje: 'x' }, AUTOR),
      ).rejects.toThrow(/esperando la revisión/);
    });

    it('un informe revisado no se elimina', async () => {
      conInforme({ estado: EstadoInformeViaje.REVISADO });

      await expect(service.remove(5, AUTOR)).rejects.toThrow(/revisado/);
    });
  });
});
