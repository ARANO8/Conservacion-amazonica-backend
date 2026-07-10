import { Module } from '@nestjs/common';
import { PartidasContablesService } from './partidas-contables.service';
import { PartidasContablesController } from './partidas-contables.controller';

@Module({
  controllers: [PartidasContablesController],
  providers: [PartidasContablesService],
})
export class PartidasContablesModule {}
