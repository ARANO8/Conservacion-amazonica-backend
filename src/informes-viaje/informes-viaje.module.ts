import { Module } from '@nestjs/common';
import { InformesViajeController } from './informes-viaje.controller';
import { InformesViajeService } from './informes-viaje.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfModule } from '../pdf/pdf.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, PdfModule, NotificacionesModule],
  controllers: [InformesViajeController],
  providers: [InformesViajeService],
  exports: [InformesViajeService],
})
export class InformesViajeModule {}
