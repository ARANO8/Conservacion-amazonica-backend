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
  Res,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiProduces,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DeclaracionesMovilidadService } from './declaraciones-movilidad.service';
import { CreateDeclaracionMovilidadDto } from './dto/create-declaracion-movilidad.dto';
import { UpdateDeclaracionMovilidadDto } from './dto/update-declaracion-movilidad.dto';
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

@ApiTags('Declaraciones de Movilidad')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('declaraciones-movilidad')
export class DeclaracionesMovilidadController {
  private readonly logger = new Logger(DeclaracionesMovilidadController.name);

  constructor(private readonly service: DeclaracionesMovilidadService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una declaración jurada de movilidad (ANEXO 6)',
  })
  create(
    @Body() dto: CreateDeclaracionMovilidadDto,
    @Req() req: RequestWithUser,
  ) {
    this.logger.log(
      `[CREATE] usuarioId=${req.user.userId} | tramos=${dto.detalles?.length ?? 0}`,
    );
    return this.service.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar declaraciones. ADMIN y EJECUTIVO ven todas; el resto sólo las propias',
  })
  findAll(@Req() req: RequestWithUser) {
    return this.service.findAll({ id: req.user.userId, rol: req.user.rol });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener el detalle de una declaración' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.findOne(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @SkipThrottle()
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar el ANEXO 6 en PDF' })
  @ApiProduces('application/pdf')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generatePdf(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="declaracion-movilidad.pdf"',
    });
    res.send(buffer);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una declaración propia' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeclaracionMovilidadDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar (lógicamente) una declaración propia' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.remove(id, req.user.userId);
  }
}
