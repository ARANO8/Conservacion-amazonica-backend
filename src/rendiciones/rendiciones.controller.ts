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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRendicionDto } from './dto/create-rendicion.dto';
import { RendicionesService } from './rendiciones.service';

interface RequestWithUser extends Request {
  user?: {
    userId: number;
    email: string;
    rol: string;
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
}
