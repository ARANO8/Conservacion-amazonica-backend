import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateLiquidacionViaticosDto } from './create-liquidacion-viaticos.dto';

/**
 * La solicitud no cambia al editar. Si vienen `hojas` se reemplazan enteras:
 * el formulario manda la lista completa.
 */
export class UpdateLiquidacionViaticosDto extends PartialType(
  OmitType(CreateLiquidacionViaticosDto, ['solicitudId'] as const),
) {}
