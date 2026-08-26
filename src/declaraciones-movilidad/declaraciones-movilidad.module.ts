import { Module } from '@nestjs/common';
import { DeclaracionesMovilidadController } from './declaraciones-movilidad.controller';
import { DeclaracionesMovilidadService } from './declaraciones-movilidad.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [PrismaModule, PdfModule],
  controllers: [DeclaracionesMovilidadController],
  providers: [DeclaracionesMovilidadService],
  exports: [DeclaracionesMovilidadService],
})
export class DeclaracionesMovilidadModule {}
