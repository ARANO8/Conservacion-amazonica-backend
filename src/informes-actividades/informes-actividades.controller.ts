import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InformesActividadesService } from './informes-actividades.service';
import { CreateInformeActividadesDto } from './dto/create-informe-actividades.dto';
import { UpdateInformeActividadesDto } from './dto/update-informe-actividades.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { Request } from 'express';
import { Rol } from '@prisma/client';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    email: string;
    rol: Rol;
  };
}

@ApiTags('Informes de Actividades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('informes-actividades')
export class InformesActividadesController {
  private readonly logger = new Logger(InformesActividadesController.name);

  constructor(private readonly service: InformesActividadesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un informe de actividades (ANEXO 7)' })
  create(
    @Body() dto: CreateInformeActividadesDto,
    @Req() req: RequestWithUser,
  ) {
    this.logger.log(
      `[CREATE] usuarioId=${req.user.userId} | actividades=${dto.actividades?.length ?? 0}`,
    );
    return this.service.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar informes. ADMIN y EJECUTIVO ven todos; el resto sólo los propios',
  })
  findAll(@Req() req: RequestWithUser) {
    return this.service.findAll({ id: req.user.userId, rol: req.user.rol });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener el detalle de un informe' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.findOne(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un informe propio' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInformeActividadesDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar (lógicamente) un informe propio' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.remove(id, req.user.userId);
  }
}
