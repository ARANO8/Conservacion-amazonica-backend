import { Module } from '@nestjs/common';
import { RendicionesController } from './rendiciones.controller';
import { RendicionesService } from './rendiciones.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PdfModule } from '../pdf/pdf.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [PrismaModule, AuthModule, PdfModule, NotificacionesModule],
  controllers: [RendicionesController],
  providers: [RendicionesService],
})
export class RendicionesModule {}
