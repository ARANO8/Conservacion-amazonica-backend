import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EstadoRendicion, EstadoSolicitud, Prisma, Rol } from '@prisma/client';
import { RendicionesService } from './rendiciones.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

/** Extrae, ya tipado, el primer argumento de la primera llamada a un mock. */
function primerArgumento<T>(mock: jest.Mock): T {
  return (mock.mock.calls as unknown as T[][])[0][0];
}

/**
 * Cliente transaccional simulado. Cada test ajusta los valores de retorno
 * relevantes para la rama CONTADOR de aprobar().
 */
type MockTx = {
  rendicion: { findUnique: jest.Mock; update: jest.Mock };
  solicitudPresupuesto: { findMany: jest.Mock };
  poa: { findMany: jest.Mock; update: jest.Mock };
  solicitud: { update: jest.Mock };
  historialAprobacion: { create: jest.Mock };
};

describe('RendicionesService', () => {
  let service: RendicionesService;
  let mockTx: MockTx;
  let prismaMock: {
    $transaction: jest.Mock;
    rendicion: { findFirst: jest.Mock };
  };

  const PARTIDA_ID = 10;
  const POA_ID = 100;
  const RENDICION_ID = 1;
  const SOLICITUD_ID = 7;
  const CONTADOR_ID = 99;

  /** Construye una rendición PENDIENTE con un gasto contra una partida. */
  const buildRendicion = (montoBruto: number) => ({
    id: RENDICION_ID,
    estado: EstadoRendicion.PENDIENTE,
    solicitudId: SOLICITUD_ID,
    aprobadorActualId: CONTADOR_ID,
    observaciones: null,
    solicitud: { observacion: null, rendicion: { id: RENDICION_ID } },
    gastosRendicion: [
      { partidaId: PARTIDA_ID, montoBruto: new Prisma.Decimal(montoBruto) },
    ],
  });

  /** Configura los retornos del tx para una ejecución contra un POA dado. */
  const setupPoa = (costoTotal: number, montoEjecutado: number) => {
    mockTx.solicitudPresupuesto.findMany.mockResolvedValue([
      { id: PARTIDA_ID, poaId: POA_ID },
    ]);
    mockTx.poa.findMany.mockResolvedValue([
      {
        id: POA_ID,
        codigoPoa: 'POA-001',
        costoTotal: new Prisma.Decimal(costoTotal),
        montoEjecutado: new Prisma.Decimal(montoEjecutado),
      },
    ]);
  };

  beforeEach(async () => {
    mockTx = {
      rendicion: { findUnique: jest.fn(), update: jest.fn() },
      solicitudPresupuesto: { findMany: jest.fn() },
      poa: { findMany: jest.fn(), update: jest.fn() },
      solicitud: { update: jest.fn() },
      historialAprobacion: { create: jest.fn() },
    };

    mockTx.rendicion.update.mockResolvedValue({
      id: RENDICION_ID,
      estado: EstadoRendicion.APROBADO,
    });
    mockTx.solicitud.update.mockResolvedValue({ id: SOLICITUD_ID });
    mockTx.historialAprobacion.create.mockResolvedValue({ id: 1 });
    mockTx.poa.update.mockResolvedValue({ id: POA_ID });

    prismaMock = {
      $transaction: jest
        .fn()
        .mockImplementation((cb: (tx: MockTx) => unknown) => cb(mockTx)),
      rendicion: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RendicionesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PdfService, useValue: {} },
        {
          provide: NotificacionesService,
          useValue: { crearNotificacion: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RendicionesService>(RendicionesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('aprobar (rama CONTADOR) — guarda de techo presupuestario', () => {
    it('rechaza la aprobación si el montoEjecutado superaría el costoTotal del POA', async () => {
      // costoTotal 1000, ya ejecutado 900, se intenta ejecutar 200 => 1100 > 1000
      mockTx.rendicion.findUnique.mockResolvedValue(buildRendicion(200));
      setupPoa(1000, 900);

      await expect(
        service.aprobar(
          RENDICION_ID,
          { comentario: 'ok' },
          CONTADOR_ID,
          Rol.CONTADOR,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      // No debe aplicarse ningún incremento ni cerrarse la rendición.
      expect(mockTx.poa.update).not.toHaveBeenCalled();
      expect(mockTx.rendicion.update).not.toHaveBeenCalled();
      expect(mockTx.solicitud.update).not.toHaveBeenCalled();
    });

    it('aprueba e incrementa el montoEjecutado cuando hay saldo suficiente', async () => {
      // costoTotal 1000, ejecutado 500, se ejecuta 200 => 700 <= 1000
      mockTx.rendicion.findUnique.mockResolvedValue(buildRendicion(200));
      setupPoa(1000, 500);

      await service.aprobar(
        RENDICION_ID,
        { comentario: 'ok' },
        CONTADOR_ID,
        Rol.CONTADOR,
      );

      expect(mockTx.poa.update).toHaveBeenCalledTimes(1);
      expect(mockTx.poa.update).toHaveBeenCalledWith({
        where: { id: POA_ID },
        data: { montoEjecutado: { increment: new Prisma.Decimal(200) } },
      });

      // Cierra la rendición y ejecuta la solicitud.
      expect(mockTx.rendicion.update).toHaveBeenCalledTimes(1);
      const rendicionArg = primerArgumento<{
        data: { estado: EstadoRendicion };
      }>(mockTx.rendicion.update);
      expect(rendicionArg.data.estado).toBe(EstadoRendicion.APROBADO);

      const solicitudArg = primerArgumento<{
        data: { estado: EstadoSolicitud };
      }>(mockTx.solicitud.update);
      expect(solicitudArg.data.estado).toBe(EstadoSolicitud.EJECUTADO);
    });

    it('permite ejecutar exactamente hasta el costoTotal (límite inclusivo)', async () => {
      // costoTotal 1000, ejecutado 800, se ejecuta 200 => 1000 == 1000 (permitido)
      mockTx.rendicion.findUnique.mockResolvedValue(buildRendicion(200));
      setupPoa(1000, 800);

      await service.aprobar(
        RENDICION_ID,
        { comentario: 'ok' },
        CONTADOR_ID,
        Rol.CONTADOR,
      );

      expect(mockTx.poa.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne — autorización (IDOR)', () => {
    const buildRendicionDe = (
      usuarioEmisorId: number,
      aprobadorActualId: number | null,
    ) => ({
      id: RENDICION_ID,
      aprobadorActualId,
      solicitud: { usuarioEmisorId },
    });

    it('niega a un USUARIO que no es emisor ni aprobador actual', async () => {
      prismaMock.rendicion.findFirst.mockResolvedValue(
        buildRendicionDe(500, 600),
      );

      await expect(
        service.findOne(RENDICION_ID, { id: 999, rol: Rol.USUARIO }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('permite al USUARIO emisor de la solicitud', async () => {
      prismaMock.rendicion.findFirst.mockResolvedValue(
        buildRendicionDe(42, 600),
      );

      await expect(
        service.findOne(RENDICION_ID, { id: 42, rol: Rol.USUARIO }),
      ).resolves.toMatchObject({ id: RENDICION_ID });
    });

    it('permite al USUARIO que es el aprobador actual', async () => {
      prismaMock.rendicion.findFirst.mockResolvedValue(
        buildRendicionDe(500, 42),
      );

      await expect(
        service.findOne(RENDICION_ID, { id: 42, rol: Rol.USUARIO }),
      ).resolves.toMatchObject({ id: RENDICION_ID });
    });

    it('permite a un rol privilegiado aunque no sea dueño', async () => {
      prismaMock.rendicion.findFirst.mockResolvedValue(
        buildRendicionDe(500, 600),
      );

      await expect(
        service.findOne(RENDICION_ID, { id: 999, rol: Rol.CONTADOR }),
      ).resolves.toMatchObject({ id: RENDICION_ID });
    });

    it('permite el acceso interno (sin usuario)', async () => {
      prismaMock.rendicion.findFirst.mockResolvedValue(
        buildRendicionDe(500, 600),
      );

      await expect(service.findOne(RENDICION_ID)).resolves.toMatchObject({
        id: RENDICION_ID,
      });
    });
  });
});
