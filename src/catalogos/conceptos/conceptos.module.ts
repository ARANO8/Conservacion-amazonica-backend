import { Module } from '@nestjs/common';
import { ConceptosService } from './conceptos.service';
import { ConceptosController } from './conceptos.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConceptosController],
  providers: [ConceptosService],
})
export class ConceptosModule {}
