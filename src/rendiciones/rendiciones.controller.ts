import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Rol } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRendicionDto } from './dto/create-rendicion.dto';
import { AprobarRendicionDto } from './dto/aprobar-rendicion.dto';
import { ObservarRendicionDto } from './dto/observar-rendicion.dto';
import { RendicionesService } from './rendiciones.service';

interface RequestWithUser extends Request {
  user?: {
    userId: number;
    email: string;
    rol: Rol;
  };
}

@ApiTags('Rendiciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rendiciones')
export class RendicionesController {
  constructor(private readonly rendicionesService: RendicionesService) {}

  @Get('solicitud/:solicitudId')
  @ApiOperation({ summary: 'Obtener la rendición por ID de solicitud' })
  @ApiResponse({
    status: 200,
    description: 'Rendición encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontró rendición para la solicitud indicada',
  })
  findBySolicitudId(@Param('solicitudId', ParseIntPipe) solicitudId: number) {
    return this.rendicionesService.findBySolicitudId(solicitudId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una rendición por ID' })
  @ApiResponse({
    status: 200,
    description: 'Rendición encontrada',
  })
  @ApiResponse({
    status: 404,
    description: 'No se encontró la rendición indicada',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rendicionesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una rendición con detalle completo' })
  @ApiResponse({
    status: 201,
    description: 'Rendición creada exitosamente',
  })
  create(
    @Body() createRendicionDto: CreateRendicionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.rendicionesService.create(createRendicionDto, req.user!.userId);
  }

  @Post(':id/aprobar')
  @ApiOperation({ summary: 'Aprobar o derivar una rendición' })
  @ApiResponse({
    status: 200,
    description: 'Rendición aprobada o derivada correctamente',
  })
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @Body() aprobarRendicionDto: AprobarRendicionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.rendicionesService.aprobar(
      id,
      aprobarRendicionDto,
      req.user!.userId,
      req.user!.rol,
    );
  }

  @Post(':id/observar')
  @ApiOperation({ summary: 'Observar una rendición y devolver al creador' })
  @ApiResponse({
    status: 200,
    description: 'Rendición observada correctamente',
  })
  observar(
    @Param('id', ParseIntPipe) id: number,
    @Body() observarRendicionDto: ObservarRendicionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.rendicionesService.observar(
      id,
      observarRendicionDto,
      req.user!.userId,
      req.user!.rol,
    );
  }
}
