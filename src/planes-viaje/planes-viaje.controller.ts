import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Logger,
  Param,
  ParseBoolPipe,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { EstadoPlanViaje, Rol } from '@prisma/client';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PlanesViajeService } from './planes-viaje.service';
import { CreatePlanViajeDto } from './dto/create-plan-viaje.dto';
import { UpdatePlanViajeDto } from './dto/update-plan-viaje.dto';
import { ObservarPlanViajeDto } from './dto/observar-plan-viaje.dto';

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

@ApiTags('Planes de Viaje')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('planes-viaje')
export class PlanesViajeController {
  private readonly logger = new Logger(PlanesViajeController.name);

  constructor(private readonly service: PlanesViajeService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un plan de viaje (ANEXO 1) en borrador' })
  create(@Body() dto: CreatePlanViajeDto, @Req() req: RequestWithUser) {
    this.logger.log(
      `[CREATE] usuarioId=${req.user.userId} | actividades=${dto.actividades?.length ?? 0}`,
    );
    return this.service.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar planes. ADMIN y EJECUTIVO ven todos; el resto, los propios y los que les enviaron para VoBo',
  })
  @ApiQuery({ name: 'estado', enum: EstadoPlanViaje, required: false })
  @ApiQuery({
    name: 'disponibles',
    type: Boolean,
    required: false,
    description:
      'Solo los propios, aprobados y sin solicitud: los que puede usar una solicitud de viaje',
  })
  findAll(
    @Req() req: RequestWithUser,
    @Query('estado', new ParseEnumPipe(EstadoPlanViaje, { optional: true }))
    estado?: EstadoPlanViaje,
    @Query('disponibles', new ParseBoolPipe({ optional: true }))
    disponibles?: boolean,
  ) {
    return this.service.findAll(contexto(req), { estado, disponibles });
  }

  @Get('pendientes')
  @ApiOperation({ summary: 'Planes enviados a mí para VoBo' })
  findPendientes(@Req() req: RequestWithUser) {
    return this.service.findPendientes(contexto(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un plan de viaje' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.findOne(id, contexto(req));
  }

  @Get(':id/anexo1')
  @ApiOperation({
    summary: 'ANEXO 1 en HTML (misma plantilla que el PDF)',
  })
  @ApiProduces('text/html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getAnexo1(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ): Promise<string> {
    return this.service.getAnexo1Html(id, contexto(req));
  }

  @SkipThrottle()
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar el ANEXO 1 en PDF' })
  @ApiProduces('application/pdf')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generatePdf(id, contexto(req));

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="plan-de-viaje.pdf"',
    });
    res.send(buffer);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Editar un plan propio (borrador u observado, o aprobado con su solicitud observada)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanViajeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.update(id, dto, req.user.userId);
  }

  @Post(':id/enviar')
  @ApiOperation({ summary: 'Enviar el plan al Director de Programa para VoBo' })
  enviar(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.enviar(id, req.user.userId);
  }

  @Post(':id/aprobar')
  @ApiOperation({ summary: 'Dar el VoBo al plan (Director de Programa)' })
  aprobar(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.aprobar(id, contexto(req));
  }

  @Post(':id/observar')
  @ApiOperation({ summary: 'Observar el plan con un motivo' })
  observar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ObservarPlanViajeDto,
    @Req() req: RequestWithUser,
  ) {
    return this.service.observar(id, dto, contexto(req));
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar (lógicamente) un plan propio sin solicitud',
  })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.service.remove(id, req.user.userId);
  }
}
