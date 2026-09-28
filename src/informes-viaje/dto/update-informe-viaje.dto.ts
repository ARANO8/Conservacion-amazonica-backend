import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateInformeViajeDto } from './create-informe-viaje.dto';

/**
 * La solicitud no cambia al editar. Si vienen `actividades` se reemplaza la
 * tabla completa: el formulario siempre envía la lista entera.
 */
export class UpdateInformeViajeDto extends PartialType(
  OmitType(CreateInformeViajeDto, ['solicitudId'] as const),
) {}
