import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CreateRendicionDto,
  CreateGastoRendicionDto,
  CreateGastoSinRespaldoDto,
  CreateInformeGastosDto,
  CreateDeclaracionJuradaDto,
} from './create-rendicion.dto';

/**
 * DTO para actualizar una rendición observada.
 * Hereda del DTO de creación pero:
 * - solicitudId no se usa (la rendición ya está vinculada)
 * - aprobadorActualId es requerido (debe elegir nuevo aprobador)
 * - El resto de campos son opcionales para permitir actualizaciones parciales
 */
export class UpdateRendicionDto extends PartialType(CreateRendicionDto) {
  /**
   * Nuevo aprobador al que se derivará la rendición corregida.
   * Es obligatorio para reenviar la rendición.
   */
  @ApiProperty({
    example: 5,
    description:
      'ID del nuevo aprobador al que se derivará la rendición corregida (obligatorio)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  aprobadorActualId: number;

  @ApiPropertyOptional({ type: [CreateGastoRendicionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGastoRendicionDto)
  gastos?: CreateGastoRendicionDto[];

  @ApiPropertyOptional({ type: [CreateGastoSinRespaldoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGastoSinRespaldoDto)
  gastosSinRespaldo?: CreateGastoSinRespaldoDto[];

  @ApiPropertyOptional({ type: CreateInformeGastosDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateInformeGastosDto)
  informeGastos?: CreateInformeGastosDto;

  @ApiPropertyOptional({ type: CreateDeclaracionJuradaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDeclaracionJuradaDto)
  declaracionJurada?: CreateDeclaracionJuradaDto;
}
