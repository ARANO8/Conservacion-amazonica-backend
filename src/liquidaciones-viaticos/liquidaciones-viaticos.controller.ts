import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Rol } from '@prisma/client';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { LiquidacionesViaticosService } from './liquidaciones-viaticos.service';
import { CreateLiquidacionViaticosDto } from './dto/create-liquidacion-viaticos.dto';
import { UpdateLiquidacionViaticosDto } from './dto/update-liquidacion-viaticos.dto';
import { ObservarLiquidacionViaticosDto } from './dto/observar-liquidacion-viaticos.dto';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    email: string;
    rol: Rol;
  };
}

function contexto(req: RequestWithUser) {
  return { id: req.user.userId, rol: req.user.rol };
}

function enviarPdf(res: Response, buffer: Buffer, nombre: string) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${nombre}.pdf"`,
  });
  res.send(buffer);
}

@ApiTags('Liquidaciones de Viáticos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('liquidaciones-viaticos')
export class LiquidacionesViaticosController {
  constructor(private readonly service: LiquidacionesViaticosService) {}

  @Get('solicitudes-disponibles')
  @ApiOperation({
    summary:
      'Solicitudes de viaje propias, desembolsadas y sin liquidación, con una hoja por persona ya calculada',
  })
  solicitudesDisponibles(@Req() req: RequestWithUser) {
    return this.service.solicitudesDisponibles(req.user.userId);
  }

  @Get('solicitud/:solicitudId/gastos-lv')
  @ApiOperation({
    summary:
      'Gastos LV de la liquidación revisada de una solicitud, listos para la rendición',
  })
  gastosLv(
    @Param('solicitudId', ParseIntPipe) solicitudId: number,
    @Req() req: RequestWithUser,
  ) {
    return this.service.gastosLv(solicitudId, contexto(req));
  }

  @Post()
  @ApiOperation({
    summary: 'Crear la liquidación de viáticos (ANEXO 5) de un viaje',
  })
  create(
    @Body() dto: CreateLiquidacionViaticosDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar liquidaciones propias y las que reviso' })
  findAll(@Req() req: RequestWithUser) {
    return this.service.findAll(contexto(req));
  }

  @Get('pendientes')
  @ApiOperation({ summary: 'Liquidaciones enviadas a mí para revisión' })
  findPendientes(@Req() req: RequestWithUser) {
    return this.service.findPendientes(contexto(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una liquidación con sus hojas' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.findOne(id, contexto(req));
  }

  @Get(':id/documento')
  @ApiOperation({ summary: 'HTML del ANEXO 5: una hoja por persona' })
  @ApiProduces('text/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getDocumento(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ): Promise<string> {
    return this.service.getDocumentoHtml(id, contexto(req));
  }

  @Get(':id/hojas/:hojaId/documento')
  @ApiOperation({ summary: 'HTML del ANEXO 5 de una persona' })
  @ApiProduces('text/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getDocumentoHoja(
    @Param('id', ParseIntPipe) id: number,
    @Param('hojaId', ParseIntPipe) hojaId: number,
    @Req() req: RequestWithUser,
  ): Promise<string> {
    return this.service.getDocumentoHtml(id, contexto(req), hojaId);
  }

  @SkipThrottle()
  @Get(':id/pdf')
  @ApiOperation({
    summary: 'ANEXO 5 del viaje en PDF (una página por persona)',
  })
  @ApiProduces('application/pdf')
  async pdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    enviarPdf(
      res,
      await this.service.generatePdf(id, contexto(req)),
      'liquidacion-viaticos',
    );
  }

  @SkipThrottle()
  @Get(':id/hojas/:hojaId/pdf')
  @ApiOperation({ summary: 'ANEXO 5 de una persona en PDF' })
  @ApiProduces('application/pdf')
  async pdfHoja(
    @Param('id', ParseIntPipe) id: number,
    @Param('hojaId', ParseIntPipe) hojaId: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    enviarPdf(
      res,
      await this.service.generatePdf(id, contexto(req), hojaId),
      'liquidacion-viaticos-persona',
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una liquidación en borrador u observada' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLiquidacionViaticosDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, req.user.userId);
  }

  @Post(':id/enviar')
  @ApiOperation({ summary: 'Enviar la liquidación al Director de Programa' })
  enviar(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.enviar(id, req.user.userId);
  }

  @Post(':id/revisar')
  @ApiOperation({ summary: 'Dar por revisada la liquidación' })
  revisar(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.revisar(id, contexto(req));
  }

  @Post(':id/observar')
  @ApiOperation({ summary: 'Observar la liquidación con un motivo' })
  observar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ObservarLiquidacionViaticosDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.observar(id, dto, contexto(req));
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar (lógicamente) una liquidación no revisada',
  })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.remove(id, req.user.userId);
  }
}
