import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SolicitudPresupuestoService } from './solicitudes-presupuestos.service';

@Module({
  imports: [PrismaModule],
  providers: [SolicitudPresupuestoService],
  exports: [SolicitudPresupuestoService],
})
export class SolicitudPresupuestoModule {}
