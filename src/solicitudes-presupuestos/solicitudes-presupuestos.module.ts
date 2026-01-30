import { Module } from '@nestjs/common';
import { SolicitudPresupuestoService } from './solicitudes-presupuestos.service';
import { SolicitudPresupuestoController } from './solicitudes-presupuestos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PoaModule } from '../poa/poa.module';

@Module({
  imports: [PrismaModule, PoaModule],
  controllers: [SolicitudPresupuestoController],
  providers: [SolicitudPresupuestoService],
  exports: [SolicitudPresupuestoService],
})
export class SolicitudPresupuestoModule {}
