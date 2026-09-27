import { PartialType } from '@nestjs/swagger';
import { CreateInformeViajeDto } from './create-informe-viaje.dto';

/**
 * Al actualizar, si vienen `actividades` se reemplaza la bitácora completa:
 * el formulario siempre envía la lista entera.
 */
export class UpdateInformeViajeDto extends PartialType(CreateInformeViajeDto) {}
