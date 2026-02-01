import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TipoGastosService } from './tipo-gastos.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Catálogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tipo-gastos')
export class TipoGastosController {
  constructor(private readonly tipoGastosService: TipoGastosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tipos de gasto' })
  findAll() {
    return this.tipoGastosService.findAll();
  }
}
