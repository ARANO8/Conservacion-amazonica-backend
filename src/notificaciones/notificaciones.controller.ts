import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificacionesService } from './notificaciones.service';

interface RequestWithUser extends Request {
  user?: {
    userId: number;
    email: string;
    rol: string;
  };
}

@ApiTags('notificaciones')
@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas mis notificaciones' })
  @ApiResponse({
    status: 200,
    description: 'Lista de notificaciones del usuario',
  })
  async getMisNotificaciones(@Req() req: RequestWithUser) {
    return this.notificacionesService.getMisNotificaciones(req.user!.userId);
  }

  @Get('unread')
  @ApiOperation({ summary: 'Obtener notificaciones no leídas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de notificaciones no leídas del usuario',
  })
  async getNotificacionesNoLeidas(@Req() req: RequestWithUser) {
    return this.notificacionesService.getNotificacionesNoLeidas(
      req.user!.userId,
    );
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Obtener conteo de notificaciones no leídas' })
  @ApiResponse({
    status: 200,
    description: 'Número de notificaciones no leídas',
  })
  async getCountNotificacionesNoLeidas(@Req() req: RequestWithUser) {
    const count =
      await this.notificacionesService.getCountNotificacionesNoLeidas(
        req.user!.userId,
      );
    return { count };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  @ApiResponse({
    status: 204,
    description: 'Todas las notificaciones marcadas como leídas',
  })
  async marcarTodasComoLeidas(@Req() req: RequestWithUser) {
    await this.notificacionesService.marcarTodasComoLeidas(req.user!.userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  @ApiResponse({
    status: 200,
    description: 'Notificación marcada como leída',
  })
  async marcarComoLeida(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.notificacionesService.marcarComoLeida(id, req.user!.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una notificación' })
  @ApiResponse({
    status: 204,
    description: 'Notificación eliminada',
  })
  async eliminarNotificacion(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    await this.notificacionesService.eliminarNotificacion(id, req.user!.userId);
  }
}
