import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TipoNotificacion =
  | 'SOLICITUD_ASIGNADA'
  | 'SOLICITUD_DERIVADA'
  | 'SOLICITUD_APROBADA'
  | 'SOLICITUD_OBSERVADA'
  | 'RENDICION_PENDIENTE';

@Injectable()
export class NotificacionesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMisNotificaciones(usuarioId: number) {
    return this.prisma.notificacion.findMany({
      where: { usuarioId },
      orderBy: { createdAt: 'desc' },
      include: {
        solicitud: {
          select: {
            id: true,
            codigoSolicitud: true,
            estado: true,
          },
        },
      },
    });
  }

  async getNotificacionesNoLeidas(usuarioId: number) {
    return this.prisma.notificacion.findMany({
      where: {
        usuarioId,
        leida: false,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        solicitud: {
          select: {
            id: true,
            codigoSolicitud: true,
            estado: true,
          },
        },
      },
    });
  }

  async getCountNotificacionesNoLeidas(usuarioId: number) {
    return this.prisma.notificacion.count({
      where: {
        usuarioId,
        leida: false,
      },
    });
  }

  async marcarComoLeida(notificacionId: number, usuarioId: number) {
    const notificacion = await this.prisma.notificacion.findUnique({
      where: { id: notificacionId },
    });

    if (!notificacion || notificacion.usuarioId !== usuarioId) {
      throw new NotFoundException('Notificación no encontrada');
    }

    return this.prisma.notificacion.update({
      where: { id: notificacionId },
      data: { leida: true },
    });
  }

  async marcarTodasComoLeidas(usuarioId: number) {
    return this.prisma.notificacion.updateMany({
      where: {
        usuarioId,
        leida: false,
      },
      data: { leida: true },
    });
  }

  async crearNotificacion(data: {
    titulo: string;
    mensaje: string;
    tipo: TipoNotificacion;
    usuarioId: number;
    solicitudId?: number;
    urlDestino?: string;
  }) {
    console.log('[NotificacionesService] Creando notificación:', {
      usuarioId: data.usuarioId,
      tipo: data.tipo,
      titulo: data.titulo,
      solicitudId: data.solicitudId,
    });

    const resultado = await this.prisma.notificacion.create({
      data: {
        titulo: data.titulo,
        mensaje: data.mensaje,
        tipo: data.tipo,
        usuarioId: data.usuarioId,
        solicitudId: data.solicitudId,
        urlDestino: data.urlDestino,
      },
      include: {
        solicitud: {
          select: {
            id: true,
            codigoSolicitud: true,
            estado: true,
          },
        },
      },
    });

    console.log('[NotificacionesService] Notificación creada exitosamente:', {
      id: resultado.id,
      usuarioId: resultado.usuarioId,
    });

    return resultado;
  }

  async eliminarNotificacion(notificacionId: number, usuarioId: number) {
    const notificacion = await this.prisma.notificacion.findUnique({
      where: { id: notificacionId },
    });

    if (!notificacion || notificacion.usuarioId !== usuarioId) {
      throw new NotFoundException('Notificación no encontrada');
    }

    return this.prisma.notificacion.delete({
      where: { id: notificacionId },
    });
  }
}
