import { Module } from '@nestjs/common';
import { InformesActividadesService } from './informes-actividades.service';
import { InformesActividadesController } from './informes-actividades.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InformesActividadesController],
  providers: [InformesActividadesService],
  exports: [InformesActividadesService],
})
export class InformesActividadesModule {}
