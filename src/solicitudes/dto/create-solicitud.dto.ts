import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoDestino, TipoDocumento } from '@prisma/client';

export class CreatePlanificacionDto {
  @ApiProperty({ example: 'Reunión con comunarios' })
  @IsString()
  actividad: string;

  @ApiProperty({ example: '2026-02-01T10:00:00Z' })
  @IsDateString()
  fechaInicio: string;

  @ApiProperty({ example: '2026-02-15T18:00:00Z' })
  @IsDateString()
  fechaFin: string;

  @ApiProperty({ example: 2, minimum: 0 })
  @IsInt()
  @Min(0)
  cantInstitucional: number;

  @ApiProperty({ example: 5, minimum: 0 })
  @IsInt()
  @Min(0)
  cantTerceros: number;

  @ApiProperty({
    example: 2.5,
    description:
      'Días explícitos (opcional). Si no se envía, se calcula automáticamente.',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dias?: number;
}

export class CreateViaticoDto {
  @ApiProperty({
    example: 0,
    description: 'Índice de la planificación relacionada',
  })
  @IsInt()
  @Min(0)
  planificacionIndex: number;

  @ApiProperty({ example: 1, description: 'ID del Concepto (Viático)' })
  @IsInt()
  conceptoId: number;

  @ApiProperty({ enum: TipoDestino, example: TipoDestino.INSTITUCIONAL })
  @IsEnum(TipoDestino)
  tipoDestino: TipoDestino;

  @ApiProperty({
    example: 2.5,
    minimum: 0.5,
    description: 'Días de viático (permite decimales)',
  })
  @IsNumber()
  @Min(0.5)
  dias: number;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  cantidadPersonas: number;

  @ApiProperty({
    example: 200,
    description: 'Monto neto a recibir (Opcional, sobreescribe catálogo)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoNeto?: number;

  @ApiProperty({
    example: 232,
    description: 'Monto presupuestado total (incl. impuestos)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montoPresupuestado?: number;

  @ApiProperty({ example: 1, description: 'ID de la línea POA asociada' })
  @IsInt()
  @Min(1)
  poaId: number;
}

export class CreateGastoDto {
  @ApiProperty({ example: 1, description: 'ID de la línea POA asociada' })
  @IsInt()
  @Min(1)
  poaId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  tipoGastoId: number;

  @ApiProperty({ enum: TipoDocumento, example: TipoDocumento.FACTURA })
  @IsEnum(TipoDocumento)
  tipoDocumento: TipoDocumento;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  cantidad: number;

  @ApiProperty({
    example: 50.5,
    minimum: 0,
    description: 'Monto neto unitario a recibir',
  })
  @IsNumber()
  @Min(0)
  montoNeto: number;

  @ApiProperty({
    example: 58.58,
    minimum: 0,
    description: 'Monto presupuestado unitario (incl. impuestos)',
  })
  @IsNumber()
  @Min(0)
  montoPresupuestado: number;

  @ApiProperty({ example: 'Compra de herramientas', required: false })
  @IsOptional()
  @IsString()
  detalle?: string;
}

export class CreateNominaDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty()
  nombreCompleto: string;

  @ApiProperty({ example: 'Institución X' })
  @IsString()
  @IsNotEmpty()
  procedenciaInstitucion: string;
}

export class CreateSolicitudDto {
  @ApiProperty({
    example: [1, 2],
    description: 'IDs de las líneas POA seleccionadas',
  })
  @IsArray()
  @IsInt({ each: true })
  poaIds: number[];

  @ApiProperty({ example: 2, description: 'ID del usuario aprobador' })
  @IsInt()
  aprobadorId: number;

  @ApiProperty({ example: 'Trinidad', description: 'Lugar del viaje' })
  @IsString()
  lugarViaje: string;

  @ApiProperty({
    example: 'Supervisión de campo',
    description: 'Motivo del viaje',
  })
  @IsString()
  motivoViaje: string;

  @ApiProperty({
    example: 'Solicitud para la misión de febrero',
    required: false,
  })
  @IsString()
  @IsOptional()
  descripcion?: string;

  @ApiProperty({ type: [CreatePlanificacionDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePlanificacionDto)
  planificaciones: CreatePlanificacionDto[];

  @ApiProperty({ type: [CreateViaticoDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateViaticoDto)
  viaticos: CreateViaticoDto[];

  @ApiProperty({ type: [CreateGastoDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateGastoDto)
  gastos: CreateGastoDto[];

  @ApiProperty({ type: [CreateNominaDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateNominaDto)
  nominasTerceros: CreateNominaDto[];
}
