import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateDetalleMovilidadDto {
  @ApiProperty({
    example: '2026-11-05T00:00:00.000Z',
    description: 'Fecha del tramo recorrido',
  })
  @Type(() => Date)
  @IsDate()
  fecha: Date;

  @ApiProperty({ example: 'La Paz' })
  @IsString()
  @IsNotEmpty({ message: 'El origen es obligatorio' })
  @MaxLength(200)
  origen: string;

  @ApiProperty({ example: 'Tarija' })
  @IsString()
  @IsNotEmpty({ message: 'El destino es obligatorio' })
  @MaxLength(200)
  destino: string;

  @ApiProperty({ example: 'Traslado al taller POA 2026' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo del traslado es obligatorio' })
  @MaxLength(500)
  motivo: string;

  @ApiProperty({
    example: 500,
    description:
      'Lo que el declarante gastó de su bolsillo. El monto con impuestos que se imprime lo calcula el servidor.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'El gasto declarado debe ser mayor a cero' })
  montoGastado: number;
}

export class CreateDeclaracionMovilidadDto {
  @ApiPropertyOptional({
    example: 'Especialista en Planificación y Monitoreo Institucional',
    description: 'Si se omite se toma el cargo registrado del usuario',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El cargo no puede quedar vacío' })
  @MaxLength(200)
  cargo?: string;

  @ApiProperty({ example: 'TALLER POA 2026' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo o actividad es obligatorio' })
  @MaxLength(300)
  motivoActividad: string;

  @ApiProperty({
    example: 'A5.1 / 10 /10 - POA: 4132 (Elaboración del POA 2026)',
  })
  @IsString()
  @IsNotEmpty({
    message: 'El proyecto o partida presupuestaria es obligatorio',
  })
  @MaxLength(300)
  proyectoPartida: string;

  @ApiPropertyOptional({ example: 'La Paz', default: 'La Paz' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lugarEmision?: string;

  @ApiProperty({ example: '2026-11-07T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  fechaEmision: Date;

  @ApiProperty({ type: [CreateDetalleMovilidadDto] })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Debes registrar al menos un tramo de movilidad',
  })
  @ValidateNested({ each: true })
  @Type(() => CreateDetalleMovilidadDto)
  detalles: CreateDetalleMovilidadDto[];
}
