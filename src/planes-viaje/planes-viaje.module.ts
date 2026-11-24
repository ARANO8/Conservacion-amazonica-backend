import { Module } from '@nestjs/common';
import { PlanesViajeController } from './planes-viaje.controller';
import { PlanesViajeService } from './planes-viaje.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [PrismaModule, PdfModule],
  controllers: [PlanesViajeController],
  providers: [PlanesViajeService],
  exports: [PlanesViajeService],
})
export class PlanesViajeModule {}
