import { Controller, Get, UseGuards } from '@nestjs/common';
import { CuentasBancariasService } from './cuentas-bancarias.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('cuentas-bancarias')
@UseGuards(JwtAuthGuard)
export class CuentasBancariasController {
  constructor(private readonly service: CuentasBancariasService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
