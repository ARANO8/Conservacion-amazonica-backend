import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { SolicitudPresupuestoService } from './solicitudes-presupuestos.service';
import { ReservarFuenteDto } from './dto/reservar-fuente.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Request } from 'express';
import { Rol } from '@prisma/client';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    email: string;
    rol: Rol;
  };
}

@ApiTags('Presupuestos (Reservas)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('presupuestos')
export class SolicitudPresupuestoController {
  constructor(private readonly service: SolicitudPresupuestoService) {}

  @Post('reservar')
  @ApiOperation({
    summary: 'Reservar una partida POA temporalmente (Sistema tipo Cine)',
  })
  @ApiResponse({ status: 201, description: 'Reserva creada o renovada' })
  @ApiResponse({
    status: 409,
    description: 'Conflicto: Reservado por otro o ya confirmado',
  })
  reservar(@Body() dto: ReservarFuenteDto, @Req() req: RequestWithUser) {
    return this.service.reservarFuente(dto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Liberar una partida reservada si el usuario se arrepiente',
  })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.remove(id, req.user.userId);
  }

  @Get('my-active')
  @ApiOperation({ summary: 'Listar reservas temporales del usuario actual' })
  findMyActive(@Req() req: RequestWithUser) {
    return this.service.findMyActive(req.user.userId);
  }
}
