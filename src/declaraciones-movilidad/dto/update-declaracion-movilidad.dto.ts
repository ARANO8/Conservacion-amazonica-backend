import { PartialType } from '@nestjs/swagger';
import { CreateDeclaracionMovilidadDto } from './create-declaracion-movilidad.dto';

export class UpdateDeclaracionMovilidadDto extends PartialType(
  CreateDeclaracionMovilidadDto,
) {}
