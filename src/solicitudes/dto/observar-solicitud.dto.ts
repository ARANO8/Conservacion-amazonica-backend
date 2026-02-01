import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class ObservarSolicitudDto {
  @ApiProperty({
    example: 'Falta adjuntar el justificativo del gasto proyectado.',
    description: 'Mensaje de feedback para el solicitante',
  })
  @IsString()
  @IsNotEmpty({ message: 'La observación no puede estar vacía' })
  observacion: string;
}
