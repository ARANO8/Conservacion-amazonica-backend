import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EstadoPlanViaje, EstadoSolicitud, Rol } from '@prisma/client';
import { PlanesViajeService } from './planes-viaje.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

/** Primer argumento de la primera llamada, tipado para las aserciones. */
function primerArgumento(mock: jest.Mock): unknown {
  return (mock.mock.calls as unknown[][])[0][0];
}

const RESPONSABLE = 42;
const DIRECTOR = 7;

function buildPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 4,
    codigoPlan: 'PV-2026-004',
    usuarioId: RESPONSABLE,
    directorProgramaId: DIRECTOR,
    estado: EstadoPlanViaje.BORRADOR,
    cargo: 'Técnico',
    lugaresViaje: 'Riberalta',
    objetivoViaje: 'Taller',
    lugarEmision: 'La Paz',
    fechaEmision: new Date('2026-10-28'),
    usuario: { nombreCompleto: 'Ana Rojas' },
    solicitud: null,
    actividades: [
      {
        id: 12,
        actividadProgramada: 'Taller comunal',
        cantidadPersonasInstitucional: 2,
        lugarSalida: 'La Paz',
        lugarLlegada: 'Riberalta',
        participantesInstitucionales: [{ id: 42 }, { id: 43 }],
      },
    ],
    ...overrides,
  };
}

describe('PlanesViajeService', () => {
  let service: PlanesViajeService;
  let prismaMock: {
    planViaje: { findFirst: jest.Mock; update: jest.Mock };
    historialAprobacion: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let notificaciones: { crearNotificacion: jest.Mock };

  beforeEach(async () => {
    prismaMock = {
      planViaje: { findFirst: jest.fn(), update: jest.fn() },
      historialAprobacion: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prismaMock)),
    };
    notificaciones = { crearNotificacion: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanesViajeService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PdfService, useValue: {} },
        { provide: NotificacionesService, useValue: notificaciones },
      ],
    }).compile();

    service = module.get(PlanesViajeService);
  });

  const conPlan = (plan: ReturnType<typeof buildPlan>) =>
    prismaMock.planViaje.findFirst.mockResolvedValue(plan);

  describe('enviar', () => {
    it('pasa a ENVIADO y notifica al Director de Programa', async () => {
      conPlan(buildPlan());

      await service.enviar(4, RESPONSABLE);

      expect(prismaMock.planViaje.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: { estado: EstadoPlanViaje.ENVIADO },
      });
      expect(notificaciones.crearNotificacion).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'PLAN_VIAJE_PENDIENTE',
          usuarioId: DIRECTOR,
        }),
      );
    });

    it('exige que la nómina institucional cuadre con lo declarado', async () => {
      const plan = buildPlan();
      plan.actividades[0].participantesInstitucionales = [{ id: 42 }];
      conPlan(plan);

      await expect(service.enviar(4, RESPONSABLE)).rejects.toThrow(
        /declaraste 2 persona\(s\) institucional\(es\) pero seleccionaste 1/,
      );
    });

    it('exige al Director de Programa', async () => {
      conPlan(buildPlan({ directorProgramaId: null }));

      await expect(service.enviar(4, RESPONSABLE)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('solo lo envía el responsable', async () => {
      conPlan(buildPlan());

      await expect(service.enviar(4, 999)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('VoBo', () => {
    it('el Director de Programa asignado lo aprueba', async () => {
      conPlan(buildPlan({ estado: EstadoPlanViaje.ENVIADO }));

      await service.aprobar(4, { id: DIRECTOR, rol: Rol.USUARIO });

      expect(primerArgumento(prismaMock.planViaje.update)).toMatchObject({
        data: { estado: EstadoPlanViaje.APROBADO },
      });
      expect(notificaciones.crearNotificacion).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'PLAN_VIAJE_APROBADO',
          usuarioId: RESPONSABLE,
        }),
      );
    });

    it('otro usuario no puede darlo, aunque sea EJECUTIVO', async () => {
      conPlan(buildPlan({ estado: EstadoPlanViaje.ENVIADO }));

      await expect(
        service.aprobar(4, { id: 999, rol: Rol.EJECUTIVO }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('observar guarda el motivo y lo devuelve al responsable', async () => {
      conPlan(buildPlan({ estado: EstadoPlanViaje.ENVIADO }));

      await service.observar(
        4,
        { motivo: '  Falta el retorno  ' },
        { id: DIRECTOR, rol: Rol.USUARIO },
      );

      expect(prismaMock.planViaje.update).toHaveBeenCalledWith({
        where: { id: 4 },
        data: {
          estado: EstadoPlanViaje.OBSERVADO,
          observacion: 'Falta el retorno',
        },
      });
    });

    it('no se da VoBo a un plan que no está enviado', async () => {
      conPlan(buildPlan({ estado: EstadoPlanViaje.BORRADOR }));

      await expect(
        service.aprobar(4, { id: DIRECTOR, rol: Rol.USUARIO }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('edición', () => {
    it('no se edita mientras espera el VoBo', async () => {
      conPlan(buildPlan({ estado: EstadoPlanViaje.ENVIADO }));

      await expect(
        service.update(4, { objetivoViaje: 'Otro' }, RESPONSABLE),
      ).rejects.toThrow(/esperando el VoBo/);
    });

    it('un plan aprobado con su solicitud en curso queda bloqueado', async () => {
      conPlan(
        buildPlan({
          estado: EstadoPlanViaje.APROBADO,
          solicitud: {
            id: 1,
            estado: EstadoSolicitud.PENDIENTE,
            deletedAt: null,
          },
        }),
      );

      await expect(
        service.update(4, { objetivoViaje: 'Otro' }, RESPONSABLE),
      ).rejects.toThrow(
        /solo se puede corregir si su solicitud está observada/,
      );
    });

    it('no se elimina un plan que respalda una solicitud activa', async () => {
      conPlan(
        buildPlan({
          estado: EstadoPlanViaje.APROBADO,
          solicitud: {
            id: 1,
            codigoSolicitud: 'SOL-2026-001',
            deletedAt: null,
          },
        }),
      );

      await expect(service.remove(4, RESPONSABLE)).rejects.toThrow(
        /respalda la solicitud SOL-2026-001/,
      );
    });
  });

  describe('obtenerParaSolicitud', () => {
    it('rechaza un plan sin VoBo', async () => {
      conPlan(buildPlan({ estado: EstadoPlanViaje.ENVIADO }));

      await expect(
        service.obtenerParaSolicitud(4, RESPONSABLE),
      ).rejects.toThrow(/VoBo/);
    });

    it('rechaza el plan de otro usuario', async () => {
      conPlan(buildPlan({ estado: EstadoPlanViaje.APROBADO }));

      await expect(service.obtenerParaSolicitud(4, 999)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rechaza un plan que ya respalda otra solicitud', async () => {
      conPlan(
        buildPlan({
          estado: EstadoPlanViaje.APROBADO,
          solicitud: { id: 1, codigoSolicitud: 'SOL-1', deletedAt: null },
        }),
      );

      await expect(
        service.obtenerParaSolicitud(4, RESPONSABLE, 2),
      ).rejects.toThrow(/ya respalda la solicitud SOL-1/);
    });

    it('admite la propia solicitud y un plan cuya solicitud se eliminó', async () => {
      conPlan(
        buildPlan({
          estado: EstadoPlanViaje.APROBADO,
          solicitud: { id: 1, codigoSolicitud: 'SOL-1', deletedAt: null },
        }),
      );
      await expect(
        service.obtenerParaSolicitud(4, RESPONSABLE, 1),
      ).resolves.toMatchObject({ id: 4 });

      conPlan(
        buildPlan({
          estado: EstadoPlanViaje.APROBADO,
          solicitud: { id: 1, codigoSolicitud: 'SOL-1', deletedAt: new Date() },
        }),
      );
      await expect(
        service.obtenerParaSolicitud(4, RESPONSABLE),
      ).resolves.toMatchObject({ id: 4 });
    });
  });
});
