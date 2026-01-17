import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CodigosPresupuestariosService } from './codigos-presupuestarios.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Catálogos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('codigos-presupuestarios')
export class CodigosPresupuestariosController {
  constructor(
    private readonly codigosPresupuestariosService: CodigosPresupuestariosService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar códigos presupuestarios' })
  findAll() {
    return this.codigosPresupuestariosService.findAll();
  }
}
