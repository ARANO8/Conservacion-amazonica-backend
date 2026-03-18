import {
  Controller,
  ForbiddenException,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

interface RequestWithUser extends Request {
  user?: {
    userId: number;
    email: string;
    rol: Rol;
  };
}

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Obtener métricas consolidadas del dashboard' })
  getMetrics(@Req() req: RequestWithUser) {
    return this.dashboardService.getMetrics(req.user!.userId, req.user!.rol);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Obtener analítica avanzada del dashboard' })
  getAnalytics(@Req() req: RequestWithUser) {
    if (req.user!.rol === Rol.USUARIO) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a la analítica avanzada',
      );
    }

    return this.dashboardService.getAdvancedAnalytics(req.user!.rol);
  }
}
