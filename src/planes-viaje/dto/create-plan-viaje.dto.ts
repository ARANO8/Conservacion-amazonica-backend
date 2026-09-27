import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Una fila del cronograma del ANEXO 1. */
export class CreateActividadPlanDto {
  @ApiPropertyOptional({
    example: 12,
    description:
      'Id de la fila existente al editar. Sin id se crea una fila nueva; las filas que no vuelven se eliminan',
  })
  @IsOptional()
  @IsInt()
  id?: number;

  @ApiProperty({ example: 'Taller de socialización con comunarios' })
  @IsString()
  @IsNotEmpty({ message: 'La actividad programada es obligatoria' })
  @MaxLength(500)
  actividadProgramada: string;

  @ApiProperty({ example: '2026-11-03' })
  @IsDateString()
  fechaInicio: string;

  @ApiProperty({ example: '2026-11-05' })
  @IsDateString()
  fechaFin: string;

  @ApiProperty({
    example: 2.5,
    description: 'Días de la actividad, editables en medios días',
  })
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5, { message: 'La actividad debe durar al menos medio día' })
  dias: number;

  @ApiProperty({ example: 'La Paz' })
  @IsString()
  @IsNotEmpty({ message: 'El lugar de salida es obligatorio' })
  @MaxLength(200)
  lugarSalida: string;

  @ApiProperty({ example: 'Riberalta' })
  @IsString()
  @IsNotEmpty({ message: 'El lugar de llegada es obligatorio' })
  @MaxLength(200)
  lugarLlegada: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1, { message: 'Debe haber al menos 1 persona institucional' })
  cantInstitucional: number;

  @ApiProperty({ example: 3, minimum: 0, maximum: 50 })
  @IsInt()
  @Min(0)
  @Max(50, { message: 'Máximo 50 terceros por actividad' })
  cantTerceros: number;

  @ApiProperty({
    example: [3, 7],
    type: [Number],
    description:
      'Usuarios institucionales que participan. Para enviar el plan deben coincidir con cantInstitucional',
  })
  @IsArray()
  @IsInt({ each: true })
  participantesInstitucionalesIds: number[];
}

export class CreatePlanViajeDto {
  @ApiPropertyOptional({
    example: 'Técnico de campo',
    description: 'Si se omite se toma el cargo registrado del usuario',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cargo?: string;

  @ApiProperty({ example: 'Riberalta - Guayaramerín' })
  @IsString()
  @IsNotEmpty({ message: 'Los lugares del viaje son obligatorios' })
  @MaxLength(300)
  lugaresViaje: string;

  @ApiProperty({ example: 'Socializar las propuestas de conservación' })
  @IsString()
  @IsNotEmpty({ message: 'El objetivo del viaje es obligatorio' })
  @MaxLength(1000)
  objetivoViaje: string;

  @ApiPropertyOptional({ example: 'La Paz', default: 'La Paz' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lugarEmision?: string;

  @ApiProperty({ example: '2026-10-28T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  fechaEmision: Date;

  @ApiPropertyOptional({
    example: 2,
    description:
      'Director de Programa que dará el VoBo. Obligatorio para enviar el plan',
  })
  @IsOptional()
  @IsInt()
  directorProgramaId?: number;

  @ApiProperty({ type: [CreateActividadPlanDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debes agregar al menos una actividad' })
  @ValidateNested({ each: true })
  @Type(() => CreateActividadPlanDto)
  actividades: CreateActividadPlanDto[];
}
