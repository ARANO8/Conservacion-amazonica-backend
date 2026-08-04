import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CuadroCotizacionDto {
  @ApiProperty({ example: 1, description: 'Posición de la columna (1..N)' })
  @IsInt()
  @Min(1)
  orden: number;

  @ApiProperty({ example: 12, description: 'ID de la cotización registrada' })
  @IsInt()
  cotizacionId: number;
}

export class CuadroPrecioDto {
  @ApiProperty({
    example: 0,
    description: 'Índice (0..N-1) de la cotización en el arreglo cotizaciones',
  })
  @IsInt()
  @Min(0)
  cotizacionIndex: number;

  @ApiPropertyOptional({ example: 1890.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioUnitario?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'true => la cotización no menciona este ítem',
  })
  @IsOptional()
  @IsBoolean()
  noMenciona?: boolean;
}

export class CuadroItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  orden: number;

  @ApiProperty({ example: 'Alquiler de salón' })
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @ApiProperty({ example: 1, minimum: 0 })
  @IsNumber()
  @Min(0)
  cantidad: number;

  @ApiPropertyOptional({ example: 'día' })
  @IsOptional()
  @IsString()
  unidad?: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Índice (0..N-1) de la cotización ganadora para este ítem (opcional)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  ganadoraCotizacionIndex?: number;

  @ApiProperty({ type: [CuadroPrecioDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CuadroPrecioDto)
  precios: CuadroPrecioDto[];
}

export class CreateCuadroComparativoDto {
  @ApiPropertyOptional({ example: 'La Paz, 23 de octubre de 2025' })
  @IsOptional()
  @IsString()
  lugarFecha?: string;

  @ApiPropertyOptional({
    example: 'Se selecciona MITRU por mejor precio total.',
  })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Índice (0..N-1) de la cotización recomendada globalmente (opcional)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  recomendadaCotizacionIndex?: number;

  @ApiProperty({ type: [CuadroCotizacionDto] })
  @IsArray()
  // Un cuadro comparativo compara: con una sola cotización no hay comparación
  @ArrayMinSize(2, {
    message: 'Selecciona al menos 2 cotizaciones para comparar',
  })
  @ValidateNested({ each: true })
  @Type(() => CuadroCotizacionDto)
  cotizaciones: CuadroCotizacionDto[];

  @ApiProperty({ type: [CuadroItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Agrega al menos un ítem para comparar' })
  @ValidateNested({ each: true })
  @Type(() => CuadroItemDto)
  items: CuadroItemDto[];
}
