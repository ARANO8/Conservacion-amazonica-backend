import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ObservarInformeViajeDto {
  @ApiProperty({ example: 'Falta detallar la reunión con la alcaldía' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo de la observación es obligatorio' })
  @MaxLength(1000)
  motivo: string;
}
