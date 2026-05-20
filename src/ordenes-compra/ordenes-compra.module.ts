import { Module } from '@nestjs/common';
import { OrdenesCompraService } from './ordenes-compra.service';
import { OrdenesCompraController } from './ordenes-compra.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
  imports: [PrismaModule, PdfModule],
  controllers: [OrdenesCompraController],
  providers: [OrdenesCompraService],
  exports: [OrdenesCompraService],
})
export class OrdenesCompraModule {}
