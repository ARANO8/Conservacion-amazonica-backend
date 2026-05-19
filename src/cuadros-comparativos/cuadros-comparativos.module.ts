import { Module } from '@nestjs/common';
import { CuadrosComparativosService } from './cuadros-comparativos.service';
import { CuadrosComparativosController } from './cuadros-comparativos.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [PrismaModule, PdfModule],
  controllers: [CuadrosComparativosController],
  providers: [CuadrosComparativosService],
  exports: [CuadrosComparativosService],
})
export class CuadrosComparativosModule {}
