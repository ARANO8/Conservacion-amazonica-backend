import * as ExcelJS from 'exceljs';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  EstadoRendicion,
  EstadoSolicitud,
  Prisma,
  Rol,
  TipoDocumento,
} from '@prisma/client';
import { RendicionesService } from './rendiciones.service';
import type { Anexo4 } from './anexo4.builder';
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
    usuario: { findFirst: jest.Mock };
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
      usuario: {
        findFirst: jest.fn().mockResolvedValue({
          nombreCompleto: 'Shirley Ramírez',
          cargo: 'Director Financiero',
        }),
      },
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
          chequeANombreDe: null,
          directorPrograma: null,
          presupuestos: [],
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
        historialAprobaciones: [],
      };

      prismaMock.rendicion.findFirst.mockResolvedValue(mockFullRendicion);

      const buffer = await service.generatePdf(RENDICION_ID);

      expect(buffer).toBeDefined();
      expect(pdfServiceMock.generatePdf).toHaveBeenCalledTimes(1);

      const [templateName, anexo, opciones] = pdfServiceMock.generatePdf.mock
        .calls[0] as [string, Anexo4, { landscape?: boolean }];
      expect(templateName).toBe('anexo4.hbs');
      expect(opciones).toMatchObject({ landscape: true });

      // Encabezado: A es siempre el Director Ejecutivo; sin Director de
      // Programa, DE cae al emisor
      expect(anexo.a).toBe('Marcos F. Terán Valenzuela');
      expect(anexo.de).toBe('Alan García');
      expect(anexo.proyecto).toBe('Especies de Amazonía');
      expect(anexo.chequeNro).toBe('DES-445');

      // 4 movimientos en orden: fondo en avance, factura, recibo, DJ
      expect(anexo.filas).toHaveLength(4);
      expect(anexo.filas[0]).toMatchObject({
        descripcion: 'FONDO EN AVANCE',
        ingreso: 1000,
        saldo: 1000,
        esFondo: true,
      });
      expect(anexo.filas.map((f) => f.saldo)).toEqual([1000, 900, 880, 875]);

      // TOTAL es el bruto (lo que se carga al POA); EGRESOS, el efectivo
      expect(anexo.totales.total).toBe(128.81);
      expect(anexo.totales.egresos).toBe(125);
      expect(anexo.totales.totalImpuestos).toBe(3.81);

      // La liquidación va sobre el efectivo: 1000 - 125 = 875 a favor del proyecto
      expect(anexo.liquidacion).toMatchObject({
        importeRecibido: 1000,
        totalGastado: 125,
        saldo: 875,
        aFavorProyecto: 875,
        aFavorEmpleado: null,
      });

      // Conteo de documentos: 1 factura y 2 no-facturas (recibo + DJ)
      expect(anexo.documentos).toMatchObject({
        facturasCantidad: 1,
        facturasMonto: 100,
        recibosCantidad: 2,
        recibosMonto: 25,
        totalCantidad: 3,
      });

      // El recibo de servicio reparte sus 3.81 en RC-IVA 13% + IT 3%
      const recibo = anexo.filas[2];
      expect(recibo.totalImpuestos).toBe(3.81);
      expect(recibo.rcIva).toBe(3.1);
      expect(recibo.it).toBe(0.71);

      // Sin partida contable asignada, los gastos se agrupan en un renglón
      expect(anexo.resumenContable).toHaveLength(1);
      expect(anexo.resumenContableTotal).toBe(128.81);

      expect(anexo.firmas.revisadoPor.nombre).toBe('Shirley Ramírez');
      expect(anexo.firmas.aprobadoPor.cargo).toBe('Director Ejecutivo');

      // El Excel lleva la misma grilla con fórmulas de saldo y totales
      const { buffer: xlsx, nombre } =
        await service.generateExcel(RENDICION_ID);
      expect(nombre).toBe('Rendicion-SOL-2026-001.xlsx');
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(xlsx as unknown as ArrayBuffer);
      const hoja = libro.getWorksheet('REND. FONDOS BS')!;
      expect(hoja.getCell('B5').value).toBe('Marcos F. Terán Valenzuela');
      expect(hoja.getCell('E16').value).toBe('FONDO EN AVANCE');
      expect(hoja.getCell('H17').value).toMatchObject({
        formula: 'H16+F17-G17',
        result: 900,
      });
      expect(hoja.getCell('G20').value).toMatchObject({
        formula: 'SUM(G16:G19)',
        result: 125,
      });
    });
  });
});
