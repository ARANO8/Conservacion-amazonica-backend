import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ObservarCuadroDto {
  @ApiProperty({ example: 'Falta cotización del proveedor X para el ítem 3.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motivo: string;
}
