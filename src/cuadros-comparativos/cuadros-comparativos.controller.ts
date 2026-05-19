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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cuadrosService.findOne(id);
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

  @Patch(':id/enviar-validacion')
  @ApiOperation({
    summary: 'Enviar el cuadro a validación (emisor; BORRADOR/OBSERVADO)',
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

  @Patch(':id/validar')
  @Roles(Rol.VALIDADOR_COMPRAS, Rol.ADMIN)
  @ApiOperation({ summary: 'Validar el cuadro (Denis) → EN_REVISION' })
  validar(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.cuadrosService.validar(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @Patch(':id/observar')
  @Roles(Rol.VALIDADOR_COMPRAS, Rol.TESORERO, Rol.ADMIN)
  @ApiOperation({
    summary: 'Observar el cuadro y devolver al emisor (validador o revisor)',
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

  @Patch(':id/aprobar')
  @Roles(Rol.TESORERO, Rol.ADMIN)
  @ApiOperation({ summary: 'Aprobar el cuadro (Shirley) → APROBADO' })
  aprobar(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser) {
    return this.cuadrosService.aprobar(id, {
      id: req.user.userId,
      rol: req.user.rol,
    });
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generar y descargar el PDF (ANEXO 11)' })
  @ApiProduces('application/pdf')
  async generatePdf(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const buffer = await this.cuadrosService.generatePdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="cuadro-comparativo.pdf"',
    });
    res.send(buffer);
  }
}
