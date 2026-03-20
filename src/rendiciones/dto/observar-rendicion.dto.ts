import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ObservarRendicionDto {
  @ApiProperty({
    example: 'Falta adjuntar respaldo del comprobante 3 y aclarar proveedor',
  })
  @IsString()
  @IsNotEmpty()
  comentario: string;
}
