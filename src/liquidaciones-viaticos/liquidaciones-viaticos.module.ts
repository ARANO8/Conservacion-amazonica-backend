import { Module } from '@nestjs/common';
import { LiquidacionesViaticosController } from './liquidaciones-viaticos.controller';
import { LiquidacionesViaticosService } from './liquidaciones-viaticos.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfModule } from '../pdf/pdf.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, PdfModule, NotificacionesModule],
  controllers: [LiquidacionesViaticosController],
  providers: [LiquidacionesViaticosService],
  exports: [LiquidacionesViaticosService],
})
export class LiquidacionesViaticosModule {}
