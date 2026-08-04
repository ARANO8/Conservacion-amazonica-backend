import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ObservarPagoDto {
  @ApiProperty({
    example: 'El recibo no coincide con el monto de la cuota',
    description: 'Motivo por el que se devuelve la cuota a Adquisiciones',
  })
  @IsString()
  @IsNotEmpty({ message: 'Debes indicar el motivo de la observación' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  @MaxLength(500, { message: 'El motivo no puede superar los 500 caracteres' })
  observacion: string;
}
