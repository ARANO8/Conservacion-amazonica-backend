import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ObservarPlanViajeDto {
  @ApiProperty({ example: 'Falta la actividad del retorno a La Paz' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo de la observación es obligatorio' })
  @MaxLength(1000)
  motivo: string;
}
