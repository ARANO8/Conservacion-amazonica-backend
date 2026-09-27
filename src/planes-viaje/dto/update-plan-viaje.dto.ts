import { PartialType } from '@nestjs/swagger';
import { CreatePlanViajeDto } from './create-plan-viaje.dto';

export class UpdatePlanViajeDto extends PartialType(CreatePlanViajeDto) {}
