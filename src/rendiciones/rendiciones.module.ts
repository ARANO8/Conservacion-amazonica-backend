import { Module } from '@nestjs/common';
import { RendicionesController } from './rendiciones.controller';
import { RendicionesService } from './rendiciones.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [PrismaModule, AuthModule, PdfModule],
  controllers: [RendicionesController],
  providers: [RendicionesService],
})
export class RendicionesModule {}
