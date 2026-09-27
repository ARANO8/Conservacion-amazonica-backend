import { Module } from '@nestjs/common';
import { InformesViajeService } from './informes-viaje.service';
import { InformesViajeController } from './informes-viaje.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InformesViajeController],
  providers: [InformesViajeService],
  exports: [InformesViajeService],
})
export class InformesViajeModule {}
