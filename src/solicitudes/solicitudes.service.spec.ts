import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  EstadoSolicitud,
  Prisma,
  Rol,
  TipoDestino,
  TipoSolicitud,
} from '@prisma/client';
import { SolicitudesService } from './solicitudes.service';
import { PrismaService } from '../prisma/prisma.service';
import { SolicitudPresupuestoService } from '../solicitudes-presupuestos/solicitudes-presupuestos.service';
import { PoaService } from '../poa/poa.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PdfService } from '../pdf/pdf.service';
import { PlanesViajeService } from '../planes-viaje/planes-viaje.service';

/** Primer argumento de la primera llamada, tipado para las aserciones. */
function primerArgumento(mock: jest.Mock): unknown {
  return (mock.mock.calls as unknown[][])[0][0];
}

/**
 * Cliente de transacción de mentira: cada `tx.<modelo>.<método>` es un
 * jest.fn creado a demanda, para poder afirmar qué se tocó y qué no.
 */
function crearTxMock() {
  const modelos = new Map<string, Record<string, jest.Mock>>();
  return new Proxy(
    {},
    {
      get(_target, modelo: string) {
        if (!modelos.has(modelo)) {
          const metodos: Record<string, jest.Mock> = {};
          modelos.set(
            modelo,
            new Proxy(metodos, {
              get(m, metodo: string) {
                m[metodo] ??= jest.fn().mockResolvedValue({ id: 1 });
                return m[metodo];
              },
            }),
          );
        }
        return modelos.get(modelo);
      },
    },
  ) as Record<string, Record<string, jest.Mock>>;
}

describe('SolicitudesService', () => {
  let service: SolicitudesService;
  let prismaMock: {
    solicitud: { findFirst: jest.Mock };
    usuario: { findFirst: jest.Mock };
    concepto: { findMany: jest.Mock };
    tipoGasto: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: ReturnType<typeof crearTxMock>;
  let planesViajeMock: { obtenerParaSolicitud: jest.Mock };

  const SOLICITUD_ID = 1;

  const buildSolicitud = (
    usuarioEmisorId: number,
    aprobadorId: number | null,
  ) => ({
    id: SOLICITUD_ID,
    usuarioEmisorId,
    aprobadorId,
  });

  beforeEach(async () => {
    tx = crearTxMock();
    prismaMock = {
      solicitud: { findFirst: jest.fn() },
      usuario: { findFirst: jest.fn() },
      concepto: { findMany: jest.fn().mockResolvedValue([]) },
      tipoGasto: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    };
    planesViajeMock = { obtenerParaSolicitud: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: SolicitudPresupuestoService,
          useValue: { recalcularTotales: jest.fn() },
        },
        { provide: PoaService, useValue: {} },
        {
          provide: NotificacionesService,
          useValue: { crearNotificacion: jest.fn() },
        },
        { provide: PdfService, useValue: {} },
        { provide: PlanesViajeService, useValue: planesViajeMock },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);

    // enriquecerConSaldos calcula saldos (no relevante para la autorización);
    // lo neutralizamos para aislar la verificación de visibilidad de findOne.
    jest
      .spyOn(
        service as unknown as {
          enriquecerConSaldos: (s: unknown) => unknown;
        },
        'enriquecerConSaldos',
      )
      .mockImplementation((s: unknown) => s);
  });

  describe('findOne — autorización (IDOR)', () => {
    it('niega a un USUARIO que no es emisor ni aprobador', async () => {
      prismaMock.solicitud.findFirst.mockResolvedValue(
        buildSolicitud(500, 600),
      );

      await expect(
        service.findOne(SOLICITUD_ID, { id: 999, rol: Rol.USUARIO }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('permite al USUARIO emisor', async () => {
      prismaMock.solicitud.findFirst.mockResolvedValue(
        buildSolicitud(42, null),
      );

      await expect(
        service.findOne(SOLICITUD_ID, { id: 42, rol: Rol.USUARIO }),
      ).resolves.toMatchObject({ id: SOLICITUD_ID });
    });

    it('permite al USUARIO que es el aprobador asignado', async () => {
      prismaMock.solicitud.findFirst.mockResolvedValue(buildSolicitud(500, 42));

      await expect(
        service.findOne(SOLICITUD_ID, { id: 42, rol: Rol.USUARIO }),
      ).resolves.toMatchObject({ id: SOLICITUD_ID });
    });

    it('permite a un rol privilegiado aunque no sea dueño', async () => {
      prismaMock.solicitud.findFirst.mockResolvedValue(
        buildSolicitud(500, 600),
      );

      await expect(
        service.findOne(SOLICITUD_ID, { id: 999, rol: Rol.CONTADOR }),
      ).resolves.toMatchObject({ id: SOLICITUD_ID });
    });

    it('permite el acceso interno (sin usuario)', async () => {
      prismaMock.solicitud.findFirst.mockResolvedValue(
        buildSolicitud(500, 600),
      );

      await expect(service.findOne(SOLICITUD_ID)).resolves.toMatchObject({
        id: SOLICITUD_ID,
      });
    });
  });

  describe('plan de viaje (ANEXO 1)', () => {
    const PLAN = {
      id: 4,
      lugaresViaje: 'Riberalta',
      objetivoViaje: 'Monitoreo de biodiversidad',
      directorProgramaId: 7,
      actividades: [
        {
          id: 12,
          actividadProgramada: 'Monitoreo',
          cantidadPersonasInstitucional: 2,
          cantidadPersonasTerceros: 1,
          fechaInicio: new Date('2026-11-03'),
          fechaFin: new Date('2026-11-05'),
        },
      ],
    };

    const viatico = {
      planificacionIds: [12],
      conceptoId: 1,
      tipoDestino: TipoDestino.INSTITUCIONAL,
      dias: 3,
      cantidadPersonas: 2,
      poaId: 10,
    };

    beforeEach(() => {
      prismaMock.concepto.findMany.mockResolvedValue([
        {
          id: 1,
          precioInstitucional: new Prisma.Decimal(200),
          precioTerceros: new Prisma.Decimal(150),
          moneda: 'BOB',
        },
      ]);
      prismaMock.usuario.findFirst.mockResolvedValue({
        id: 7,
        rol: Rol.USUARIO,
      });
      planesViajeMock.obtenerParaSolicitud.mockResolvedValue(PLAN);
    });

    it('rechaza una solicitud de viaje sin plan', async () => {
      await expect(
        service.create(
          { tipo: TipoSolicitud.VIAJE, aprobadorId: 7, poaIds: [10] } as never,
          42,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(planesViajeMock.obtenerParaSolicitud).not.toHaveBeenCalled();
    });

    describe('corregir una solicitud observada', () => {
      beforeEach(() => {
        prismaMock.solicitud.findFirst.mockResolvedValue({
          id: SOLICITUD_ID,
          usuarioEmisorId: 42,
          aprobadorId: null,
          estado: EstadoSolicitud.OBSERVADO,
          tipo: TipoSolicitud.VIAJE,
          directorProgramaId: 7,
          planViajeId: PLAN.id,
          presupuestos: [{ poaId: 10 }],
          montoTotalPresupuestado: new Prisma.Decimal(0),
          montoTotalNeto: new Prisma.Decimal(0),
          fechaInicio: null,
          fechaFin: null,
        });
        tx.solicitud.update.mockResolvedValue({
          id: SOLICITUD_ID,
          codigoSolicitud: 'SOL-2026-001',
        });
      });

      const nominaCompleta = [
        {
          nombreCompleto: 'Ana Rojas',
          procedenciaInstitucion: 'Comunidad Tres Hermanos',
          planificacionId: 12,
        },
      ];

      it('no borra las actividades del plan y registra la corrección', async () => {
        await service.update(
          SOLICITUD_ID,
          { viaticos: [viatico], nominasTerceros: nominaCompleta } as never,
          42,
        );

        expect(planesViajeMock.obtenerParaSolicitud).toHaveBeenCalledWith(
          PLAN.id,
          42,
          SOLICITUD_ID,
        );
        expect(tx.planificacion.deleteMany).not.toHaveBeenCalled();
        expect(primerArgumento(tx.viatico.create)).toMatchObject({
          data: { planificaciones: { connect: [{ id: 12 }] } },
        });
        expect(primerArgumento(tx.solicitud.update)).toMatchObject({
          data: {
            lugarViaje: PLAN.lugaresViaje,
            motivoViaje: PLAN.objetivoViaje,
            fechaInicio: PLAN.actividades[0].fechaInicio,
            fechaFin: PLAN.actividades[0].fechaFin,
          },
        });
        expect(primerArgumento(tx.historialAprobacion.create)).toMatchObject({
          data: { accion: 'CORREGIDO' },
        });
      });

      it('rechaza un viático asignado a una actividad ajena al plan', async () => {
        await expect(
          service.update(
            SOLICITUD_ID,
            {
              viaticos: [{ ...viatico, planificacionIds: [99] }],
              nominasTerceros: nominaCompleta,
            } as never,
            42,
          ),
        ).rejects.toThrow(/no pertenece al plan/);
      });

      it('exige la nómina de terceros que declara el plan', async () => {
        await expect(
          service.update(
            SOLICITUD_ID,
            { viaticos: [viatico], nominasTerceros: [] } as never,
            42,
          ),
        ).rejects.toThrow(/declara 1 tercero\(s\) pero la nómina registra 0/);
      });
    });
  });
});
