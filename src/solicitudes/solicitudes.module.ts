import { Module } from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudesController } from './solicitudes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';
import { SolicitudPresupuestoModule } from '../solicitudes-presupuestos/solicitudes-presupuestos.module';
import { PoaModule } from '../poa/poa.module';

@Module({
  imports: [PrismaModule, ReportsModule, SolicitudPresupuestoModule, PoaModule],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
