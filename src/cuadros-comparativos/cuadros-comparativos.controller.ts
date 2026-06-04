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
import { CuadrosComparativosService } from './cuadros-comparativos.service';
import { CreateCuadroComparativoDto } from './dto/create-cuadro-comparativo.dto';
import { UpdateCuadroComparativoDto } from './dto/update-cuadro-comparativo.dto';
import { ObservarCuadroDto } from './dto/observar-cuadro.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Request, Response } from 'express';
import { Rol } from '@prisma/client';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    email: string;
    rol: Rol;
  };
}

@ApiTags('Cuadros Comparativos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cuadros-comparativos')
export class CuadrosComparativosController {
  private readonly logger = new Logger(CuadrosComparativosController.name);

  constructor(private readonly cuadrosService: CuadrosComparativosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo cuadro comparativo' })
  create(@Body() dto: CreateCuadroComparativoDto, @Req() req: RequestWithUser) {
    this.logger.log(
      `[CREATE] usuarioId=${req.user.userId} | cotizaciones=${dto.cotizaciones?.length ?? 0} | items=${dto.items?.length ?? 0}`,
    );
    return this.cuadrosService.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar cuadros comparativos (propios; vista global para ADMIN/EJECUTIVO)',
  })
  findAll(@Req() req: RequestWithUser) {
    return this.cuadrosService.findAll({
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de un cuadro comparativo' })
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.cuadrosService.findOne(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un cuadro comparativo' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCuadroComparativoDto,
    @Req() req: RequestWithUser,
  ) {
    return this.cuadrosService.update(id, dto, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un cuadro comparativo (Soft Delete)' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.cuadrosService.remove(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  /**
   * PASO 1 — Emisor → CONTADOR
   * BORRADOR / OBSERVADO → EN_REVISION
   */
  @Patch(':id/enviar-revision')
  @ApiOperation({
    summary: 'Emisor envía el cuadro al CONTADOR para revisión inicial',
  })
  enviarARevision(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.cuadrosService.enviarARevision(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  /**
   * PASO 2 — CONTADOR → Denis (VALIDADOR_COMPRAS)
   * EN_REVISION → EN_VALIDACION
   */
  @Patch(':id/enviar-validacion')
  @Roles(Rol.CONTADOR, Rol.ADMIN)
  @ApiOperation({
    summary: 'CONTADOR envía el cuadro a validación (Denis)',
  })
  enviarAValidacion(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.cuadrosService.enviarAValidacion(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  /**
   * PASO 3 — Denis valida, devuelve al CONTADOR
   * EN_VALIDACION → REVISADO
   */
  @Patch(':id/validar')
  @Roles(Rol.VALIDADOR_COMPRAS, Rol.ADMIN)
  @ApiOperation({ summary: 'Denis valida el cuadro y lo devuelve al CONTADOR' })
  validar(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.cuadrosService.validar(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  /**
   * PASO 4 — CONTADOR → Shirley (EJECUTIVO)
   * REVISADO → EN_APROBACION
   */
  @Patch(':id/enviar-aprobacion')
  @Roles(Rol.CONTADOR, Rol.ADMIN)
  @ApiOperation({
    summary: 'CONTADOR envía el cuadro validado a Shirley para aprobación',
  })
  enviarAAprobacion(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    return this.cuadrosService.enviarAAprobacion(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  /**
   * PASO 5 — Shirley (EJECUTIVO) aprueba
   * EN_APROBACION → APROBADO
   */
  @Patch(':id/aprobar')
  @Roles(Rol.EJECUTIVO, Rol.ADMIN)
  @ApiOperation({ summary: 'Shirley aprueba el cuadro → APROBADO' })
  aprobar(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.cuadrosService.aprobar(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  /**
   * Observar — devuelve al emisor desde cualquier etapa activa
   */
  @Patch(':id/observar')
  @Roles(Rol.VALIDADOR_COMPRAS, Rol.CONTADOR, Rol.EJECUTIVO, Rol.ADMIN)
  @ApiOperation({
    summary: 'Observar el cuadro y devolver al emisor (cualquier revisor)',
  })
  observar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ObservarCuadroDto,
    @Req() req: RequestWithUser,
  ) {
    return this.cuadrosService.observar(
      id,
      { id: req.user.userId, rol: req.user.rol },
      dto.motivo,
    );
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generar y descargar el PDF (ANEXO 11)' })
  @ApiProduces('application/pdf')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    const buffer = await this.cuadrosService.generatePdf(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="cuadro-comparativo.pdf"',
    });
    res.send(buffer);
  }
}
