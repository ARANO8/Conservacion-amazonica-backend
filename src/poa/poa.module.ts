import { Module } from '@nestjs/common';
import { PoaService } from './poa.service';
import { PoaController } from './poa.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PoaController],
  providers: [PoaService],
  exports: [PoaService],
})
export class PoaModule {}
