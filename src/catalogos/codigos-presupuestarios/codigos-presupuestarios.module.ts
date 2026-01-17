import { Module } from '@nestjs/common';
import { CodigosPresupuestariosService } from './codigos-presupuestarios.service';
import { CodigosPresupuestariosController } from './codigos-presupuestarios.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CodigosPresupuestariosController],
  providers: [CodigosPresupuestariosService],
})
export class CodigosPresupuestariosModule {}
