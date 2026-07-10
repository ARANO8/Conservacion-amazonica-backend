import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateGastoPartidaContableDto {
  @ApiProperty({
    example: '5.1.2.1.00',
    description:
      'Código de la partida contable a vincular. Enviar null para desvincular.',
    required: false,
  })
  @IsOptional()
  @IsString()
  codigo?: string | null;
}
