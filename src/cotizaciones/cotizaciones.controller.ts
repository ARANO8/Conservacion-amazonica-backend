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
  Res,
  Logger,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiProduces,
} from '@nestjs/swagger';
import { CotizacionesService } from './cotizaciones.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { Request, Response } from 'express';
import { Rol } from '@prisma/client';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    email: string;
    rol: Rol;
  };
}

@ApiTags('Cotizaciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cotizaciones')
export class CotizacionesController {
  private readonly logger = new Logger(CotizacionesController.name);

  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva cotización' })
  create(
    @Body() createCotizacionDto: CreateCotizacionDto,
    @Req() req: RequestWithUser,
  ) {
    this.logger.log(
      `[CREATE] usuarioId=${req.user.userId} | proveedor=${createCotizacionDto.proveedorNombre} | lineas=${createCotizacionDto.lineas?.length ?? 0}`,
    );
    return this.cotizacionesService.create(
      createCotizacionDto,
      req.user.userId,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Listar cotizaciones (propias; vista global para ADMIN/EJECUTIVO)',
  })
  findAll(@Req() req: RequestWithUser) {
    return this.cotizacionesService.findAll({
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una cotización' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.cotizacionesService.findOne(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una cotización' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCotizacionDto: UpdateCotizacionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.cotizacionesService.update(id, updateCotizacionDto, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una cotización (Soft Delete)' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.cotizacionesService.remove(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @SkipThrottle()
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generar y descargar el PDF de la cotización' })
  @ApiProduces('application/pdf')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.cotizacionesService.generatePdf(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="cotizacion.pdf"',
    });
    return buffer;
  }
}
