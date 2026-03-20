import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AprobarRendicionDto {
  @ApiPropertyOptional({
    example: 'Rendición revisada y conforme para el siguiente nivel',
  })
  @IsOptional()
  @IsString()
  comentario?: string;

  @ApiPropertyOptional({
    example: 4,
    description:
      'ID del usuario al que se deriva la rendición (obligatorio si quien aprueba no es TESORERO)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  derivadoAId?: number;
}
