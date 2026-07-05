import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EstadoRendicion, EstadoSolicitud, Prisma, Rol, TipoDocumento } from '@prisma/client';
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
  let pdfServiceMock: {
    generatePdf: jest.Mock;
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

    pdfServiceMock = {
      generatePdf: jest.fn().mockResolvedValue(Buffer.from('pdf-data')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RendicionesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PdfService, useValue: pdfServiceMock },
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

  describe('generatePdf — cálculos de Anexo 4', () => {
    it('genera un ledger cronológico y agrupa los gastos por partida', async () => {
      const mockFullRendicion = {
        id: RENDICION_ID,
        fechaRendicion: new Date('2026-06-25'),
        montoRespaldado: new Prisma.Decimal(128.81),
        saldoLiquido: new Prisma.Decimal(871.19),
        estado: EstadoRendicion.PENDIENTE,
        aprobadorActualId: 2,
        observaciones: 'Ninguna',
        createdAt: new Date('2026-06-25'),
        solicitud: {
          id: SOLICITUD_ID,
          codigoSolicitud: 'SOL-2026-001',
          motivoViaje: 'Monitoreo de bosques',
          montoTotalNeto: new Prisma.Decimal(1000),
          fechaSolicitud: new Date('2026-06-20'),
          fechaDesembolso: new Date('2026-06-21'),
          codigoDesembolso: 'DES-445',
          proyecto: 'Especies de Amazonía',
          usuarioEmisor: {
            id: 1,
            nombreCompleto: 'Alan García',
            cargo: 'Técnico de Campo',
            rol: Rol.USUARIO,
          },
        },
        gastosRendicion: [
          {
            id: 101,
            tipoDocumento: TipoDocumento.FACTURA,
            nroDocumento: '10022',
            fecha: new Date('2026-06-22'),
            concepto: 'Gasolina',
            detalle: 'Gasolina para camioneta',
            proveedor: 'Surtidor Sur',
            montoBruto: new Prisma.Decimal(100),
            montoImpuestos: new Prisma.Decimal(0),
            montoNeto: new Prisma.Decimal(100),
            partida: {
              id: PARTIDA_ID,
              poa: {
                codigoPoa: 'POA-001',
                estructura: {
                  partida: {
                    id: PARTIDA_ID,
                    nombre: 'Combustibles',
                  },
                },
              },
            },
          },
          {
            id: 102,
            tipoDocumento: TipoDocumento.RECIBO,
            nroDocumento: '045',
            fecha: new Date('2026-06-23'),
            concepto: 'Almuerzo Terceros',
            detalle: 'Servicio de comida',
            proveedor: 'Doña Flora',
            montoBruto: new Prisma.Decimal(23.81),
            montoImpuestos: new Prisma.Decimal(3.81),
            montoNeto: new Prisma.Decimal(20),
            partida: {
              id: PARTIDA_ID,
              poa: {
                codigoPoa: 'POA-001',
                estructura: {
                  partida: {
                    id: PARTIDA_ID,
                    nombre: 'Combustibles',
                  },
                },
              },
            },
          },
        ],
        declaracionesJuradas: [
          {
            id: 201,
            fecha: new Date('2026-06-24'),
            detalle: 'Peaje local',
            monto: new Prisma.Decimal(5),
          },
        ],
        informeGastos: {
          fechaInicio: new Date('2026-06-21'),
          fechaFin: new Date('2026-06-24'),
          actividades: [],
        },
        historialAprobaciones: [],
      };

      prismaMock.rendicion.findFirst.mockResolvedValue(mockFullRendicion);

      const buffer = await service.generatePdf(RENDICION_ID);

      expect(buffer).toBeDefined();
      expect(pdfServiceMock.generatePdf).toHaveBeenCalledTimes(1);

      const [templateName, params] = pdfServiceMock.generatePdf.mock.calls[0];
      expect(templateName).toBe('rendicion.hbs');
      
      // Debe registrar 4 movimientos: Anticipo, Factura, Recibo, DJ
      expect(params.transacciones).toHaveLength(4);
      
      // Primera transacción es el anticipo de 1000 Bs
      expect(params.transacciones[0]).toMatchObject({
        concepto: expect.stringContaining('Anticipo recibido'),
        ingreso: expect.stringContaining('1.000,00'),
        saldo: expect.stringContaining('1.000,00'),
      });

      // El total presupuestado restando brutos (100 + 23.81 + 5 = 128.81)
      expect(params.totalPresupuestado).toContain('128,81');
      expect(params.totalEfectivoPagado).toContain('125,00'); // (100 + 20 + 5)
      expect(params.totalImpuestosRetenidos).toContain('3,81');

      // Saldo líquido final (1000 - 128.81 = 871.19)
      expect(params.saldoLiquidoFormat).toContain('871,19');
      expect(params.saldoEsDevolucion).toBe(true);

      // Resumen contable agrupado por partida (Combustibles/POA-001 y S/P)
      expect(params.resumenContable).toHaveLength(2);
    });
  });
});
