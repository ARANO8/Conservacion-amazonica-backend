import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Logger,
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
import { InformesViajeService } from './informes-viaje.service';
import { CreateInformeViajeDto } from './dto/create-informe-viaje.dto';
import { UpdateInformeViajeDto } from './dto/update-informe-viaje.dto';
import { ObservarInformeViajeDto } from './dto/observar-informe-viaje.dto';

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

@ApiTags('Informes de Viaje')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('informes-viaje')
export class InformesViajeController {
  private readonly logger = new Logger(InformesViajeController.name);

  constructor(private readonly service: InformesViajeService) {}

  @Get('solicitudes-disponibles')
  @ApiOperation({
    summary:
      'Solicitudes de viaje propias, desembolsadas y sin informe, con lo que el informe precarga',
  })
  solicitudesDisponibles(@Req() req: RequestWithUser) {
    return this.service.solicitudesDisponibles(req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un informe de viaje (ANEXO 7) en borrador' })
  create(@Body() dto: CreateInformeViajeDto, @Req() req: RequestWithUser) {
    this.logger.log(
      `[CREATE] usuarioId=${req.user.userId} | solicitudId=${dto.solicitudId} | actividades=${dto.actividades?.length ?? 0}`,
    );
    return this.service.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar informes. ADMIN y EJECUTIVO ven todos; el resto, los propios y los que les enviaron para revisar',
  })
  findAll(@Req() req: RequestWithUser) {
    return this.service.findAll(contexto(req));
  }

  @Get('pendientes')
  @ApiOperation({ summary: 'Informes enviados a mí para revisión' })
  findPendientes(@Req() req: RequestWithUser) {
    return this.service.findPendientes(contexto(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un informe de viaje' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.findOne(id, contexto(req));
  }

  @Get(':id/documento')
  @ApiOperation({
    summary: 'HTML del ANEXO 7, con la misma plantilla que el PDF',
  })
  @ApiProduces('text/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getDocumento(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ): Promise<string> {
    return this.service.getDocumentoHtml(id, contexto(req));
  }

  @SkipThrottle()
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar el ANEXO 7 en PDF' })
  @ApiProduces('application/pdf')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generatePdf(id, contexto(req));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="informe-de-viaje.pdf"',
    });
    res.send(buffer);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un informe propio en borrador u observado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInformeViajeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, req.user.userId);
  }

  @Post(':id/enviar')
  @ApiOperation({ summary: 'Enviar el informe al Director de Programa' })
  enviar(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.enviar(id, req.user.userId);
  }

  @Post(':id/revisar')
  @ApiOperation({
    summary: 'Dar por revisado el informe (Director de Programa)',
  })
  revisar(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.revisar(id, contexto(req));
  }

  @Post(':id/observar')
  @ApiOperation({ summary: 'Observar el informe con un motivo' })
  observar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ObservarInformeViajeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.observar(id, dto, contexto(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar (lógicamente) un informe propio' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.remove(id, req.user.userId);
  }
}
