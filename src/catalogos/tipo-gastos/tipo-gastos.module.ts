import { Module } from '@nestjs/common';
import { TipoGastosService } from './tipo-gastos.service';
import { TipoGastosController } from './tipo-gastos.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TipoGastosController],
  providers: [TipoGastosService],
})
export class TipoGastosModule {}
