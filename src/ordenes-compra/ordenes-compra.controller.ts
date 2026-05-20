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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiProduces,
} from '@nestjs/swagger';
import { OrdenesCompraService } from './ordenes-compra.service';
import { CreateOrdenCompraDto } from './dto/create-orden-compra.dto';
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

@ApiTags('Ordenes de Compra')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ordenes-compra')
export class OrdenesCompraController {
  private readonly logger = new Logger(OrdenesCompraController.name);

  constructor(private readonly service: OrdenesCompraService) {}

  @Get('prefill/:cuadroId')
  @ApiOperation({
    summary: 'Prellenar orden desde un cuadro comparativo aprobado',
  })
  prefill(@Param('cuadroId', ParseIntPipe) cuadroId: number) {
    return this.service.prefillFromCuadro(cuadroId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una orden de compra/servicio' })
  create(@Body() dto: CreateOrdenCompraDto, @Req() req: RequestWithUser) {
    this.logger.log(
      `[CREATE] usuarioId=${req.user.userId} | items=${dto.items?.length ?? 0}`,
    );
    return this.service.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar órdenes de compra' })
  findAll(@Req() req: RequestWithUser) {
    return this.service.findAll({ id: req.user.userId, rol: req.user.rol });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una orden de compra' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una orden de compra' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOrdenCompraDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una orden de compra (Soft Delete)' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.remove(id, { id: req.user.userId, rol: req.user.rol });
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generar y descargar el PDF (ANEXO 12)' })
  @ApiProduces('application/pdf')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="orden-compra.pdf"',
    });
    res.send(buffer);
  }
}
