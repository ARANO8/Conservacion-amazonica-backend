import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ObservarLiquidacionViaticosDto {
  @ApiProperty({
    example: 'Ana Rojas recibió alimentación el día 2: va al 50%',
  })
  @IsString()
  @IsNotEmpty({ message: 'El motivo de la observación es obligatorio' })
  @MaxLength(1000)
  motivo: string;
}
