import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class AprobarSolicitudDto {
  @ApiPropertyOptional({
    example: 3,
    description:
      'ID del usuario al que se deriva. En un viaje es opcional: el Director de Programa la envía a Dirección Financiera (Tesorero). En las demás solicitudes es obligatorio',
  })
  @IsOptional()
  @IsInt()
  nuevoAprobadorId?: number;
}
