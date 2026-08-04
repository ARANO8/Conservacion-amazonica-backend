import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CreateActividadInformeDto {
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
  @IsNotEmpty({ message: 'La persona o institución es obligatoria' })
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

export class CreateInformeActividadesDto {
  @ApiProperty({
    example: '2026-03-10T00:00:00.000Z',
    description: 'Fecha de inicio del viaje',
  })
  @Type(() => Date)
  @IsDate()
  fechaInicio: Date;

  @ApiProperty({
    example: '2026-03-14T00:00:00.000Z',
    description: 'Fecha de fin del viaje',
  })
  @Type(() => Date)
  @IsDate()
  fechaFin: Date;

  @ApiProperty({ type: [CreateActividadInformeDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debes registrar al menos una actividad' })
  @ValidateNested({ each: true })
  @Type(() => CreateActividadInformeDto)
  actividades: CreateActividadInformeDto[];
}
