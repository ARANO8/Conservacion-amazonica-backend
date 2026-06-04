import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EstadoCuadroComparativo, Rol } from '@prisma/client';
import { CuadrosComparativosService } from './cuadros-comparativos.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../pdf/pdf.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { UpdateCuadroComparativoDto } from './dto/update-cuadro-comparativo.dto';

type MockTx = {
  cuadroComparativo: { update: jest.Mock; findUniqueOrThrow: jest.Mock };
  cuadroPrecio: { deleteMany: jest.Mock; create: jest.Mock };
  cuadroItem: { deleteMany: jest.Mock; create: jest.Mock };
  cuadroCotizacion: {
    deleteMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

describe('CuadrosComparativosService', () => {
  let service: CuadrosComparativosService;
  let mockTx: MockTx;
  let prismaMock: {
    cuadroComparativo: { findFirst: jest.Mock };
    cotizacion: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const CUADRO_ID = 1;
  const USER = { id: 1, rol: Rol.ADMIN };

  /** DTO de reestructuración: 1 cotización, 1 ítem con 1 precio. */
  const buildUpdateDto = (): UpdateCuadroComparativoDto =>
    ({
      lugarFecha: 'La Paz, 2026',
      recomendadaCotizacionIndex: 0,
      cotizaciones: [{ orden: 1, cotizacionId: 50 }],
      items: [
        {
          orden: 1,
          descripcion: 'Item A',
          cantidad: 2,
          precios: [{ cotizacionIndex: 0, precioUnitario: 10 }],
        },
      ],
    }) as unknown as UpdateCuadroComparativoDto;

  beforeEach(async () => {
    mockTx = {
      cuadroComparativo: {
        update: jest.fn().mockResolvedValue({ id: CUADRO_ID }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: CUADRO_ID }),
      },
      cuadroPrecio: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 700 }),
      },
      cuadroItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 600 }),
      },
      cuadroCotizacion: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 500 }),
        update: jest.fn().mockResolvedValue({ id: 500 }),
      },
    };

    prismaMock = {
      cuadroComparativo: {
        findFirst: jest.fn().mockResolvedValue({
          id: CUADRO_ID,
          usuarioEmisorId: USER.id,
          estado: EstadoCuadroComparativo.BORRADOR,
          lugarFecha: 'La Paz',
          observaciones: null,
        }),
      },
      cotizacion: { findMany: jest.fn() },
      $transaction: jest
        .fn()
        .mockImplementation((cb: (tx: MockTx) => unknown) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CuadrosComparativosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: PdfService, useValue: {} },
        {
          provide: NotificacionesService,
          useValue: { crearNotificacion: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CuadrosComparativosService>(
      CuadrosComparativosService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update (reestructuración) — atomicidad', () => {
    it('borra y reconstruye dentro de UNA sola transacción', async () => {
      prismaMock.cotizacion.findMany.mockResolvedValue([
        { id: 50, proveedorNombre: 'ACME' },
      ]);

      await service.update(CUADRO_ID, buildUpdateDto(), USER);

      // El fix garantiza una única transacción (antes eran dos).
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

      // Dentro de esa transacción ocurren tanto el borrado como la reconstrucción.
      expect(mockTx.cuadroPrecio.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockTx.cuadroItem.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockTx.cuadroCotizacion.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockTx.cuadroCotizacion.create).toHaveBeenCalledTimes(1);
      expect(mockTx.cuadroItem.create).toHaveBeenCalledTimes(1);
      expect(mockTx.cuadroPrecio.create).toHaveBeenCalledTimes(1);
    });

    it('valida las cotizaciones ANTES de abrir la transacción (no hay borrado si la entrada es inválida)', async () => {
      // Falta la cotización 50 => findMany devuelve menos de las solicitadas.
      prismaMock.cotizacion.findMany.mockResolvedValue([]);

      await expect(
        service.update(CUADRO_ID, buildUpdateDto(), USER),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Nunca se abre la transacción, por lo que la estructura existente queda intacta.
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(mockTx.cuadroCotizacion.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne — autorización (IDOR) por estado', () => {
    const buildCuadro = (
      usuarioEmisorId: number,
      estado: EstadoCuadroComparativo,
    ) => ({ id: CUADRO_ID, usuarioEmisorId, estado });

    it('niega a un USUARIO ajeno', async () => {
      prismaMock.cuadroComparativo.findFirst.mockResolvedValue(
        buildCuadro(500, EstadoCuadroComparativo.BORRADOR),
      );

      await expect(
        service.findOne(CUADRO_ID, { id: 999, rol: Rol.USUARIO }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('permite al emisor ver el suyo', async () => {
      prismaMock.cuadroComparativo.findFirst.mockResolvedValue(
        buildCuadro(42, EstadoCuadroComparativo.BORRADOR),
      );

      await expect(
        service.findOne(CUADRO_ID, { id: 42, rol: Rol.USUARIO }),
      ).resolves.toMatchObject({ id: CUADRO_ID });
    });

    it('permite a ADMIN/EJECUTIVO ver cualquiera', async () => {
      prismaMock.cuadroComparativo.findFirst.mockResolvedValue(
        buildCuadro(500, EstadoCuadroComparativo.EN_APROBACION),
      );

      await expect(
        service.findOne(CUADRO_ID, { id: 999, rol: Rol.EJECUTIVO }),
      ).resolves.toMatchObject({ id: CUADRO_ID });
    });

    it('CONTADOR ve EN_REVISION ajenos pero no BORRADOR ajenos', async () => {
      prismaMock.cuadroComparativo.findFirst.mockResolvedValue(
        buildCuadro(500, EstadoCuadroComparativo.EN_REVISION),
      );
      await expect(
        service.findOne(CUADRO_ID, { id: 999, rol: Rol.CONTADOR }),
      ).resolves.toMatchObject({ id: CUADRO_ID });

      prismaMock.cuadroComparativo.findFirst.mockResolvedValue(
        buildCuadro(500, EstadoCuadroComparativo.BORRADOR),
      );
      await expect(
        service.findOne(CUADRO_ID, { id: 999, rol: Rol.CONTADOR }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('VALIDADOR_COMPRAS ve EN_VALIDACION ajenos pero no EN_REVISION ajenos', async () => {
      prismaMock.cuadroComparativo.findFirst.mockResolvedValue(
        buildCuadro(500, EstadoCuadroComparativo.EN_VALIDACION),
      );
      await expect(
        service.findOne(CUADRO_ID, { id: 999, rol: Rol.VALIDADOR_COMPRAS }),
      ).resolves.toMatchObject({ id: CUADRO_ID });

      prismaMock.cuadroComparativo.findFirst.mockResolvedValue(
        buildCuadro(500, EstadoCuadroComparativo.EN_REVISION),
      );
      await expect(
        service.findOne(CUADRO_ID, { id: 999, rol: Rol.VALIDADOR_COMPRAS }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('permite el acceso interno (sin usuario)', async () => {
      prismaMock.cuadroComparativo.findFirst.mockResolvedValue(
        buildCuadro(500, EstadoCuadroComparativo.BORRADOR),
      );

      await expect(service.findOne(CUADRO_ID)).resolves.toMatchObject({
        id: CUADRO_ID,
      });
    });
  });
});
