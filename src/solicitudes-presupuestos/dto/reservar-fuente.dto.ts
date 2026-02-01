import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class ReservarFuenteDto {
  @ApiProperty({ description: 'ID de la línea POA a reservar' })
  @IsNumber()
  poaId: number;
}
