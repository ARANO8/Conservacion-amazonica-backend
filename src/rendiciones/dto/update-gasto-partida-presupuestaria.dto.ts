import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt } from 'class-validator';

export class UpdateGastoPartidaPresupuestariaDto {
  @ApiProperty({
    example: 5,
    description:
      'ID de la partida presupuestaria (SolicitudPresupuesto) a vincular. Enviar null para desvincular.',
    required: false,
  })
  @IsOptional()
  @IsInt()
  partidaId?: number | null;
}
