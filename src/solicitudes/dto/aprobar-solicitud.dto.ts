import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class AprobarSolicitudDto {
  @ApiProperty({
    example: 3,
    description: 'ID del nuevo usuario para derivar la solicitud (Obligatorio)',
  })
  @IsNotEmpty({
    message: 'El ID del nuevo aprobador es obligatorio para derivar',
  })
  @IsInt()
  nuevoAprobadorId: number;
}
