import { Module } from '@nestjs/common';
import { PlanesViajeController } from './planes-viaje.controller';
import { PlanesViajeService } from './planes-viaje.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfModule } from '../pdf/pdf.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, PdfModule, NotificacionesModule],
  controllers: [PlanesViajeController],
  providers: [PlanesViajeService],
  exports: [PlanesViajeService],
})
export class PlanesViajeModule {}
