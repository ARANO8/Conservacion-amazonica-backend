import { PartialType } from '@nestjs/swagger';
import { CreateCuadroComparativoDto } from './create-cuadro-comparativo.dto';

export class UpdateCuadroComparativoDto extends PartialType(
  CreateCuadroComparativoDto,
) {}
