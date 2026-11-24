import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { EstadoSolicitud, Rol } from '@prisma/client';
import { PlanesViajeService } from './planes-viaje.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { faltanteDelPlan, planCompleto } from './planes-viaje.helper';

/** Primer argumento de la primera llamada, tipado para las aserciones. */
function primerArgumento(mock: jest.Mock): unknown {
  return (mock.mock.calls as unknown[][])[0][0];
}

const RESPONSABLE = 42;

function buildPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 4,
    codigoPlan: 'PV-2026-004',
    usuarioId: RESPONSABLE,
    cargo: 'Técnico',
    lugaresViaje: 'Riberalta',
    objetivoViaje: 'Taller',
    lugarEmision: 'La Paz',
    fechaEmision: new Date('2026-10-28'),
    usuario: { nombreCompleto: 'Ana Rojas' },
    solicitud: null as Record<string, unknown> | null,
    actividades: [
      {
        id: 12,
        actividadProgramada: 'Taller comunal',
        cantidadPersonasInstitucional: 2,
        lugarSalida: 'La Paz' as string | null,
        lugarLlegada: 'Riberalta' as string | null,
        participantesInstitucionales: [{ id: 42 }, { id: 43 }],
      },
    ],
    ...overrides,
  };
}

const actividadDto = {
  id: 12,
  actividadProgramada: 'Taller comunal',
  fechaInicio: '2026-11-03',
  fechaFin: '2026-11-05',
  dias: 3,
  lugarSalida: 'La Paz',
  lugarLlegada: 'Riberalta',
  cantInstitucional: 2,
  cantTerceros: 0,
  participantesInstitucionalesIds: [42],
};

describe('planCompleto', () => {
  it('un plan con la nómina institucional cuadrada está completo', () => {
    expect(planCompleto(buildPlan())).toBe(true);
  });

  it('dice qué actividad no cuadra', () => {
    const plan = buildPlan();
    plan.actividades[0].participantesInstitucionales = [{ id: 42 }];

    expect(faltanteDelPlan(plan)).toMatch(
      /declaraste 2 persona\(s\) institucional\(es\) pero seleccionaste 1/,
    );
  });

  it('exige salida y llegada en cada actividad', () => {
    const plan = buildPlan();
    plan.actividades[0].lugarSalida = null;

    expect(faltanteDelPlan(plan)).toMatch(/lugar de salida o el de llegada/);
  });

  it('un plan sin actividades no está completo', () => {
    expect(planCompleto(buildPlan({ actividades: [] }))).toBe(false);
  });
});

describe('PlanesViajeService', () => {
  let service: PlanesViajeService;
  let prismaMock: {
    planViaje: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    planificacion: { update: jest.Mock; deleteMany: jest.Mock };
    usuario: { count: jest.Mock };
    historialAprobacion: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      planViaje: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      planificacion: { update: jest.fn(), deleteMany: jest.fn() },
      usuario: { count: jest.fn() },
      historialAprobacion: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanesViajeService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PdfService, useValue: {} },
      ],
    }).compile();

    service = module.get(PlanesViajeService);
  });

  const conPlan = (plan: ReturnType<typeof buildPlan>) =>
    prismaMock.planViaje.findFirst.mockResolvedValue(plan);

  describe('findAll', () => {
    it('disponibles: propios, libres y solo los completos', async () => {
      const incompleto = buildPlan({ id: 5 });
      incompleto.actividades[0].participantesInstitucionales = [];
      prismaMock.planViaje.findMany.mockResolvedValue([
        buildPlan(),
        incompleto,
      ]);

      const planes = await service.findAll(
        { id: RESPONSABLE, rol: Rol.USUARIO },
        { disponibles: true },
      );

      expect(planes.map((p) => p.id)).toEqual([4]);
      expect(primerArgumento(prismaMock.planViaje.findMany)).toMatchObject({
        where: { usuarioId: RESPONSABLE, deletedAt: null },
      });
    });

    it('un USUARIO ve solo los propios', async () => {
      prismaMock.planViaje.findMany.mockResolvedValue([]);

      await service.findAll({ id: RESPONSABLE, rol: Rol.USUARIO });

      expect(primerArgumento(prismaMock.planViaje.findMany)).toMatchObject({
        where: { usuarioId: RESPONSABLE },
      });
    });
  });

  describe('edición', () => {
    it('un plan libre se guarda a medio completar, sin historial', async () => {
      conPlan(buildPlan());
      prismaMock.usuario.count.mockResolvedValue(1);

      await service.update(
        4,
        { actividades: [actividadDto] as never },
        RESPONSABLE,
      );

      expect(prismaMock.planificacion.update).toHaveBeenCalled();
      expect(prismaMock.historialAprobacion.create).not.toHaveBeenCalled();
    });

    it('con su solicitud en curso queda bloqueado', async () => {
      conPlan(
        buildPlan({
          solicitud: {
            id: 1,
            codigoSolicitud: 'SOL-2026-001',
            estado: EstadoSolicitud.PENDIENTE,
            deletedAt: null,
          },
        }),
      );

      await expect(
        service.update(4, { objetivoViaje: 'Otro' }, RESPONSABLE),
      ).rejects.toThrow(
        /solo se puede corregir si esa solicitud está observada/,
      );
    });

    it('con su solicitud observada se corrige completo y queda registrado', async () => {
      const solicitud = {
        id: 1,
        codigoSolicitud: 'SOL-2026-001',
        estado: EstadoSolicitud.OBSERVADO,
        deletedAt: null,
      };
      conPlan(buildPlan({ solicitud }));

      // Vinculado, la nómina debe cuadrar ya
      await expect(
        service.update(
          4,
          { actividades: [actividadDto] as never },
          RESPONSABLE,
        ),
      ).rejects.toThrow(/declara 2 persona\(s\)/);

      prismaMock.usuario.count.mockResolvedValue(2);
      await service.update(
        4,
        {
          actividades: [
            { ...actividadDto, participantesInstitucionalesIds: [42, 43] },
          ] as never,
        },
        RESPONSABLE,
      );
      expect(
        primerArgumento(prismaMock.historialAprobacion.create),
      ).toMatchObject({ data: { accion: 'CORREGIDO', planViajeId: 4 } });
    });

    it('solo lo edita el responsable', async () => {
      conPlan(buildPlan());

      await expect(
        service.update(4, { objetivoViaje: 'Otro' }, 999),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('no se elimina un plan que respalda una solicitud activa', async () => {
      conPlan(
        buildPlan({
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
    it('admite un plan completo sin ninguna aprobación', async () => {
      conPlan(buildPlan());

      await expect(
        service.obtenerParaSolicitud(4, RESPONSABLE),
      ).resolves.toMatchObject({ id: 4 });
    });

    it('rechaza un plan incompleto y dice qué falta', async () => {
      const plan = buildPlan();
      plan.actividades[0].participantesInstitucionales = [{ id: 42 }];
      conPlan(plan);

      await expect(
        service.obtenerParaSolicitud(4, RESPONSABLE),
      ).rejects.toThrow(/PV-2026-004 está incompleto.*seleccionaste 1/);
    });

    it('rechaza el plan de otro usuario', async () => {
      conPlan(buildPlan());

      await expect(service.obtenerParaSolicitud(4, 999)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rechaza un plan que ya respalda otra solicitud', async () => {
      conPlan(
        buildPlan({
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
          solicitud: { id: 1, codigoSolicitud: 'SOL-1', deletedAt: null },
        }),
      );
      await expect(
        service.obtenerParaSolicitud(4, RESPONSABLE, 1),
      ).resolves.toMatchObject({ id: 4 });

      conPlan(
        buildPlan({
          solicitud: { id: 1, codigoSolicitud: 'SOL-1', deletedAt: new Date() },
        }),
      );
      await expect(
        service.obtenerParaSolicitud(4, RESPONSABLE),
      ).resolves.toMatchObject({ id: 4 });
    });
  });
});
