import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/** Una fila de la tabla del ANEXO 7. */
export class CreateActividadInformeViajeDto {
  @ApiProperty({
    example: '2026-03-12T00:00:00.000Z',
    description: 'Fecha de la actividad',
  })
  @Type(() => Date)
  @IsDate()
  fecha: Date;

  @ApiProperty({ example: 'Cobija' })
  @IsString()
  @IsNotEmpty({ message: 'El lugar de la actividad es obligatorio' })
  @MaxLength(200)
  lugar: string;

  @ApiProperty({ example: 'Gobierno Autónomo Municipal de Cobija' })
  @IsString()
  @IsNotEmpty({ message: 'La persona, institución o lugar es obligatorio' })
  @MaxLength(300)
  personaInstitucion: string;

  @ApiProperty({
    example:
      'Reunión de coordinación con actores locales y validación de agenda.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Debes describir las actividades realizadas' })
  @MaxLength(2000)
  actividadesRealizadas: string;
}

export class CreateInformeViajeDto {
  @ApiProperty({
    example: 30,
    description:
      'Solicitud de viaje propia y desembolsada de la que se informa (una por solicitud)',
  })
  @IsInt()
  solicitudId: number;

  @ApiProperty({ example: 'Socializar las propuestas de conservación' })
  @IsString()
  @IsNotEmpty({ message: 'El motivo del viaje es obligatorio' })
  @MaxLength(1000)
  motivoViaje: string;

  @ApiProperty({ example: 'Riberalta - Guayaramerín' })
  @IsString()
  @IsNotEmpty({ message: 'El lugar de viaje es obligatorio' })
  @MaxLength(300)
  lugarViaje: string;

  @ApiPropertyOptional({ example: 'La Paz', default: 'La Paz' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lugarEmision?: string;

  @ApiProperty({ example: '2026-03-16T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  fechaEmision: Date;

  @ApiPropertyOptional({
    example: 4,
    description:
      'Director de Programa que revisa. Por defecto el de la solicitud; obligatorio para enviar',
  })
  @IsOptional()
  @IsInt()
  directorProgramaId?: number;

  @ApiProperty({ type: [CreateActividadInformeViajeDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debes registrar al menos una actividad' })
  @ValidateNested({ each: true })
  @Type(() => CreateActividadInformeViajeDto)
  actividades: CreateActividadInformeViajeDto[];
}
