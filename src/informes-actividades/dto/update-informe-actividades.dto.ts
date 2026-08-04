import { PartialType } from '@nestjs/swagger';
import { CreateInformeActividadesDto } from './create-informe-actividades.dto';

/**
 * Al actualizar, si vienen `actividades` se reemplaza la bitácora completa:
 * el formulario siempre envía la lista entera.
 */
export class UpdateInformeActividadesDto extends PartialType(
  CreateInformeActividadesDto,
) {}
