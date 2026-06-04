import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { SolicitudesService } from './solicitudes.service';
import { PrismaService } from '../prisma/prisma.service';
import { SolicitudPresupuestoService } from '../solicitudes-presupuestos/solicitudes-presupuestos.service';
import { PoaService } from '../poa/poa.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PdfService } from '../pdf/pdf.service';

describe('SolicitudesService', () => {
  let service: SolicitudesService;
  let prismaMock: { solicitud: { findFirst: jest.Mock } };

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
    prismaMock = { solicitud: { findFirst: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SolicitudPresupuestoService, useValue: {} },
        { provide: PoaService, useValue: {} },
        {
          provide: NotificacionesService,
          useValue: { crearNotificacion: jest.fn() },
        },
        { provide: PdfService, useValue: {} },
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
});
