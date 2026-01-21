import { Module } from '@nestjs/common';
import { SolicitudPresupuestoService } from './solicitudes-presupuestos.service';
import { SolicitudPresupuestoController } from './solicitudes-presupuestos.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SolicitudPresupuestoController],
  providers: [SolicitudPresupuestoService],
  exports: [SolicitudPresupuestoService],
})
export class SolicitudPresupuestoModule {}
