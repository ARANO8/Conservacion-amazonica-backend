import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PORCENTAJES_VIATICO } from '../liquidacion.helper';

/** Una fila de la liquidación: tarifa × porcentaje × días. */
export class CreateFilaLiquidacionDto {
  @ApiProperty({ example: 1, description: 'Tarifa del catálogo de viáticos' })
  @IsInt()
  conceptoId: number;

  @ApiProperty({ example: 100, enum: PORCENTAJES_VIATICO })
  @IsIn(PORCENTAJES_VIATICO, {
    message: 'El porcentaje debe ser 100 (viático completo) o 50 (medio)',
  })
  porcentaje: number;

  @ApiProperty({ example: 2.5, description: 'Días, en medios días' })
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5, { message: 'Mínimo medio día' })
  dias: number;

  @ApiPropertyOptional({
    example: 15,
    description:
      'Partida (SolicitudPresupuesto) a la que se imputa; por defecto la del viático institucional',
  })
  @IsOptional()
  @IsInt()
  solicitudPresupuestoId?: number;
}

/** El ANEXO 5 de una persona. */
export class CreateHojaLiquidacionDto {
  @ApiProperty({
    example: 3,
    description: 'Beneficiario (personal institucional)',
  })
  @IsInt()
  usuarioId: number;

  @ApiProperty({ example: 'Técnico de campo' })
  @IsString()
  @MaxLength(200)
  cargo: string;

  @ApiPropertyOptional({ example: '4876543 LP' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ci?: string;

  @ApiPropertyOptional({ example: 'La Paz', default: 'La Paz' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sede?: string;

  @ApiPropertyOptional({ example: 'Aérea' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  via?: string;

  @ApiPropertyOptional({
    example: 'Comunidad',
    description: 'Tipo de destino; por defecto el de la tarifa con más días',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  escala?: string;

  @ApiProperty({ example: 'Taller comunal de socialización' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo del viaje es obligatorio' })
  @MaxLength(1000)
  motivoViaje: string;

  @ApiProperty({ example: 'Riberalta' })
  @IsString()
  @IsNotEmpty({ message: 'El destino es obligatorio' })
  @MaxLength(300)
  destino: string;

  @ApiProperty({ example: '2026-11-03T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  fechaSalida: Date;

  @ApiProperty({ example: '2026-11-05T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  fechaRetorno: Date;

  @ApiProperty({ type: [CreateFilaLiquidacionDto] })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Cada hoja necesita al menos una fila de viático',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateFilaLiquidacionDto)
  filas: CreateFilaLiquidacionDto[];
}

export class CreateLiquidacionViaticosDto {
  @ApiProperty({
    example: 30,
    description:
      'Solicitud de viaje propia y desembolsada (una liquidación por solicitud)',
  })
  @IsInt()
  solicitudId: number;

  @ApiPropertyOptional({ example: 'La Paz', default: 'La Paz' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lugarEmision?: string;

  @ApiProperty({ example: '2026-11-10T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  fechaEmision: Date;

  @ApiPropertyOptional({
    example: 4,
    description: 'Director de Programa que revisa; obligatorio para enviar',
  })
  @IsOptional()
  @IsInt()
  directorProgramaId?: number;

  @ApiProperty({ type: [CreateHojaLiquidacionDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'La liquidación necesita al menos una persona' })
  @ValidateNested({ each: true })
  @Type(() => CreateHojaLiquidacionDto)
  hojas: CreateHojaLiquidacionDto[];
}
