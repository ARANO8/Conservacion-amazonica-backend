import { Module } from '@nestjs/common';
import { PartidasContablesController } from './partidas-contables.controller';
import { PartidasContablesService } from './partidas-contables.service';

@Module({
  controllers: [PartidasContablesController],
  providers: [PartidasContablesService],
  exports: [PartidasContablesService],
})
export class PartidasContablesModule {}
